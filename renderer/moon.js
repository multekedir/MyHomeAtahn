/**
 * moon.js — Lunar phase, position, and calendar utilities.
 * Based on Jean Meeus, "Astronomical Algorithms" (2nd ed.), chapters 47-49.
 *
 * Usage:
 *   const mc = new MoonCalc();
 *   const phase = mc.getPhase('2026-02-09');
 *   const riseSet = mc.getRiseSet('2026-02-09', [45.52, -122.68], -8);
 *   const nm = mc.nextPhase('2026-02-09', 'new');
 *   const hijri = mc.approxHijri('2026-02-09');
 *   const events = mc.nextPhases('2026-02-09', 8);
 */

class MoonCalc {
  static SYNODIC_MONTH = 29.530588861;
  static PHASE_NAMES = [
    [0.000,'New Moon','🌑'],[0.125,'Waxing Crescent','🌒'],[0.250,'First Quarter','🌓'],
    [0.375,'Waxing Gibbous','🌔'],[0.500,'Full Moon','🌕'],[0.625,'Waning Gibbous','🌖'],
    [0.750,'Last Quarter','🌗'],[0.875,'Waning Crescent','🌘'],[1.000,'New Moon','🌑'],
  ];
  static HIJRI_MONTHS = [
    'Muharram','Safar',"Rabi' al-Awwal","Rabi' al-Thani","Jumada al-Ula","Jumada al-Thani",
    'Rajab',"Sha'ban",'Ramadan','Shawwal',"Dhul-Qi'dah",'Dhul-Hijjah',
  ];

  getPhase(dateInput=null) {
    const d=this._parseDate(dateInput);
    const jd=MoonCalc._julian(d.getFullYear(),d.getMonth()+1,d.getDate()+0.5);
    const [lonMoon,,distMoon]=this._moonPosition(jd);
    const lonSun=this._sunLongitude(jd);
    const elongation=MoonCalc._fixangle(lonMoon-lonSun);
    const phaseAngle=180-elongation;
    const illumination=(1+Math.cos(phaseAngle*Math.PI/180))/2;
    const phaseFraction=elongation/360;
    const age=phaseFraction*MoonCalc.SYNODIC_MONTH;
    const [name,emoji]=this._phaseName(phaseFraction);
    const angDiam=2*(Math.atan(1737.4/distMoon)*180/Math.PI)*60;
    return {
      phase:Math.round(phaseFraction*10000)/10000,
      illumination:Math.round(illumination*10000)/10000,
      age:Math.round(age*100)/100,
      name,emoji,
      angle:Math.round(phaseAngle*100)/100,
      elongation:Math.round(elongation*100)/100,
      distance_km:Math.round(distMoon*10)/10,
      angular_diameter_arcmin:Math.round(angDiam*100)/100,
    };
  }

  getPosition(dateInput=null) {
    const d=this._parseDate(dateInput);
    const jd=MoonCalc._julian(d.getFullYear(),d.getMonth()+1,d.getDate()+0.5);
    const [lon,lat,dist]=this._moonPosition(jd);
    const [ra,decl]=this._eclipticToEquatorial(lon,lat,jd);
    return {longitude:Math.round(lon*1e4)/1e4,latitude:Math.round(lat*1e4)/1e4,
      distance_km:Math.round(dist*10)/10,right_ascension:Math.round(ra*1e4)/1e4,
      declination:Math.round(decl*1e4)/1e4};
  }

  getRiseSet(dateInput=null,coords=[0,0],tz=0,fmt='24h') {
    const d=this._parseDate(dateInput);
    const [lat,lng]=coords;
    const jd=MoonCalc._julian(d.getFullYear(),d.getMonth()+1,d.getDate());
    const positions=[];
    for(const h of [0,0.5,1]) {
      const [lonM,latM,dist]=this._moonPosition(jd+h);
      const [ra,decl]=this._eclipticToEquatorial(lonM,latM,jd+h);
      positions.push([ra,decl,Math.asin(6378.14/dist)*180/Math.PI]);
    }
    const theta0=this._gmst(jd);
    const h0=-(0.7275*positions[1][2]-0.5667);
    const results={};
    for(const event of ['transit','rise','set']) {
      const result=this._riseSetTransit(theta0,positions,lat,lng,h0,event);
      results[event]=result!==null?MoonCalc._formatTime(((result+tz)%24+24)%24,fmt):null;
    }
    return results;
  }

  nextPhase(dateInput=null,phase='new') {
    const d=this._parseDate(dateInput);
    const targets={new:0,first_quarter:0.25,full:0.5,last_quarter:0.75};
    if(!(phase in targets)) throw new Error(`Unknown phase: ${phase}`);
    const target=targets[phase];
    const yearFrac=d.getFullYear()+d.getMonth()/12+(d.getDate()-1)/365.25;
    let k=Math.floor((yearFrac-2000)*12.3685)+target;
    for(let i=0;i<15;i++) {
      const rd=MoonCalc._jdToDate(this._truePhaseJd(k,target));
      if(rd>=d) return rd;
      k+=1;
    }
    return d;
  }

  nextPhases(dateInput=null,count=8) {
    const d=this._parseDate(dateInput);
    const phases=['new','first_quarter','full','last_quarter'];
    const info={new:['New Moon','🌑'],first_quarter:['First Quarter','🌓'],full:['Full Moon','🌕'],last_quarter:['Last Quarter','🌗']};
    let events=[];
    for(const p of phases) {const dt=this.nextPhase(d,p);events.push({date:dt,phase:p,name:info[p][0],emoji:info[p][1]});}
    events.sort((a,b)=>a.date-b.date);
    while(events.length<count) {
      const last=new Date(events[events.length-1].date);last.setDate(last.getDate()+1);
      for(const p of phases) {const dt=this.nextPhase(last,p);events.push({date:dt,phase:p,name:info[p][0],emoji:info[p][1]});}
      events.sort((a,b)=>a.date-b.date);
      const seen=new Set();events=events.filter(e=>{const k=`${e.date.toISOString().slice(0,10)}-${e.phase}`;if(seen.has(k))return false;seen.add(k);return true;});
    }
    return events.slice(0,count);
  }

  approxHijri(dateInput=null) {
    const d=this._parseDate(dateInput);
    const prevNew=this._previousNewMoon(d);
    const moonAge=Math.round((d-prevNew)/864e5)+1;
    const hijriEpoch=new Date(622,6,19);
    const totalDays=Math.round((d-hijriEpoch)/864e5);
    const hijriYearLen=12*MoonCalc.SYNODIC_MONTH;
    const hijriYear=Math.floor(totalDays/hijriYearLen)+1;
    const dayInYear=totalDays-(hijriYear-1)*hijriYearLen;
    const hijriMonth=Math.min(Math.floor(dayInYear/MoonCalc.SYNODIC_MONTH)+1,12);
    return {year:hijriYear,month:hijriMonth,day:Math.max(1,Math.min(moonAge,30)),
      monthName:MoonCalc.HIJRI_MONTHS[hijriMonth-1]||'?'};
  }

  monthCalendar(year,month) {
    const numDays=new Date(year,month,0).getDate();
    const result=[];
    for(let day=1;day<=numDays;day++) {const d=new Date(year,month-1,day);result.push({date:d,...this.getPhase(d)});}
    return result;
  }

  // ---- Moon position (Meeus ch.47) ----
  _moonPosition(jd) {
    const T=(jd-2451545)/36525,T2=T*T,T3=T2*T,T4=T3*T;
    const Lp=MoonCalc._fixangle(218.3164477+481267.88123421*T-0.0015786*T2+T3/538841-T4/65194000);
    const Mm=MoonCalc._fixangle(134.9633964+477198.8675055*T+0.0087414*T2+T3/69699-T4/14712000);
    const Ms=MoonCalc._fixangle(357.5291092+35999.0502909*T-0.0001536*T*T+T3/24490000);
    const D=MoonCalc._fixangle(297.8501921+445267.1114034*T-0.0018819*T2+T3/545868-T4/113065000);
    const F=MoonCalc._fixangle(93.2720950+483202.0175233*T-0.0036539*T*T-T3/3526000+T4/863310000);
    const E=1-0.002516*T-0.0000074*T*T;
    const r=a=>a*Math.PI/180;
    const lrT=[[0,0,1,0,6288774,-20905355],[2,0,-1,0,1274027,-3699111],[2,0,0,0,658314,-2955968],[0,0,2,0,213618,-569925],[0,1,0,0,-185116,48888],[0,0,0,2,-114332,-3149],[2,0,-2,0,58793,246158],[2,-1,-1,0,57066,-152138],[2,0,1,0,53322,-170733],[2,-1,0,0,45758,-204586],[0,1,-1,0,-40923,-129620],[1,0,0,0,-34720,108743],[0,1,1,0,-30383,104755],[2,0,0,-2,15327,10321],[0,0,1,2,-12528,0],[0,0,1,-2,10980,79661],[4,0,-1,0,10675,-34782],[0,0,3,0,10034,-23210],[4,0,-2,0,8548,-21636],[2,1,-1,0,-7888,24208],[2,1,0,0,-6766,30824],[1,0,-1,0,-5163,-8379],[1,1,0,0,4987,-16675],[2,-1,1,0,4036,-12831],[2,0,2,0,3994,-10445],[4,0,0,0,3861,-11650],[2,0,-3,0,3665,14403],[0,1,-2,0,-2689,-7003],[2,0,-1,2,-2602,0],[2,-1,-2,0,2390,10056],[1,0,1,0,-2348,6322],[2,-2,0,0,2236,-9884],[0,1,2,0,-2120,5751],[0,2,0,0,-2069,0],[2,-2,-1,0,2048,-4950],[2,0,1,-2,-1773,4130],[2,0,0,2,-1595,0],[4,-1,-1,0,1215,-3958],[0,0,2,2,-1110,0],[3,0,-1,0,-892,3258],[2,1,1,0,-810,2616],[4,-1,-2,0,759,-1897],[0,2,-1,0,-713,-2117],[2,2,-1,0,-700,2354],[2,1,-2,0,691,0],[2,-1,0,-2,596,0],[4,0,1,0,549,-1423],[0,0,4,0,537,-1117],[4,-1,0,0,520,-1571]];
    const bT=[[0,0,0,1,5128122],[0,0,1,1,280602],[0,0,1,-1,277693],[2,0,0,-1,173237],[2,0,-1,1,55413],[2,0,-1,-1,46271],[2,0,0,1,32573],[0,0,2,1,17198],[2,0,1,-1,9266],[0,0,2,-1,8822],[2,-1,0,-1,8216],[2,0,-2,-1,4324],[2,0,1,1,4200],[2,1,0,-1,-3359],[2,-1,-1,1,2463],[2,-1,0,1,2211],[2,-1,-1,-1,2065],[0,1,-1,-1,-1870],[4,0,-1,-1,1828],[0,1,0,1,-1794],[0,0,0,3,-1749],[0,1,-1,1,-1565],[1,0,0,1,-1491],[0,1,1,1,-1475],[0,1,1,-1,-1410],[0,1,0,-1,-1344],[1,0,0,-1,-1335],[0,0,3,1,1107],[4,0,0,-1,1021],[4,0,-1,1,833]];
    let sL=0,sR=0,sB=0;
    for(const [dm,msm,mmm,fm,sl,cr] of lrT){const arg=r(dm*D+msm*Ms+mmm*Mm+fm*F);const ef=E**Math.abs(msm);sL+=sl*ef*Math.sin(arg);sR+=cr*ef*Math.cos(arg);}
    for(const [dm,msm,mmm,fm,sb] of bT){sB+=sb*(E**Math.abs(msm))*Math.sin(r(dm*D+msm*Ms+mmm*Mm+fm*F));}
    const a1=r(MoonCalc._fixangle(119.75+131.849*T)),a2=r(MoonCalc._fixangle(53.09+479264.290*T)),a3=r(MoonCalc._fixangle(313.45+481266.484*T));
    const LpR=r(Lp),FR=r(F),MmR=r(Mm);
    sL+=3958*Math.sin(a1)+1962*Math.sin(LpR-FR)+318*Math.sin(a2);
    sB+=-2235*Math.sin(LpR)+382*Math.sin(a3)+175*Math.sin(a1-FR)+175*Math.sin(a1+FR)+127*Math.sin(LpR-MmR)-115*Math.sin(LpR+MmR);
    return [MoonCalc._fixangle(Lp+sL/1e6),sB/1e6,385000.56+sR/1000];
  }

  _sunLongitude(jd) {
    const T=(jd-2451545)/36525;
    const L0=MoonCalc._fixangle(280.46646+36000.76983*T+0.0003032*T*T);
    const M=MoonCalc._fixangle(357.52911+35999.05029*T-0.0001537*T*T);
    const Mr=M*Math.PI/180;
    return MoonCalc._fixangle(L0+(1.914602-T*(0.004817+0.000014*T))*Math.sin(Mr)+(0.019993-0.000101*T)*Math.sin(2*Mr)+0.000289*Math.sin(3*Mr));
  }

  _eclipticToEquatorial(lon,lat,jd) {
    const eps=(23.439291-0.0130042*(jd-2451545)/36525)*Math.PI/180;
    const lonR=lon*Math.PI/180,latR=lat*Math.PI/180;
    const ra=Math.atan2(Math.sin(lonR)*Math.cos(eps)-Math.tan(latR)*Math.sin(eps),Math.cos(lonR))*180/Math.PI;
    const decl=Math.asin(Math.sin(latR)*Math.cos(eps)+Math.cos(latR)*Math.sin(eps)*Math.sin(lonR))*180/Math.PI;
    return [MoonCalc._fixangle(ra),decl];
  }

  _gmst(jd) {
    const T=(jd-2451545)/36525;
    return MoonCalc._fixangle(280.46061837+360.98564736629*(jd-2451545)+0.000387933*T*T-T*T*T/38710000);
  }

  _riseSetTransit(theta0,positions,lat,lng,h0,event) {
    let [ra0,dec0]=positions[0],[ra1,dec1]=positions[1],[ra2,dec2]=positions[2];
    if(ra1-ra0>180)ra0+=360;if(ra0-ra1>180)ra1+=360;if(ra2-ra1>180)ra1+=360;if(ra1-ra2>180)ra2+=360;
    const r=a=>a*Math.PI/180;
    const cosH0=(Math.sin(r(h0))-Math.sin(r(lat))*Math.sin(r(dec1)))/(Math.cos(r(lat))*Math.cos(r(dec1)));
    if(Math.abs(cosH0)>1)return null;
    const H0=Math.acos(cosH0)*180/Math.PI;
    let mT=((ra1-lng-theta0)/360%1+1)%1;
    let m=event==='transit'?mT:event==='rise'?((mT-H0/360)%1+1)%1:((mT+H0/360)%1+1)%1;
    for(let i=0;i<2;i++) {
      const n=m+0.5;let raM,decM;
      if(n<=0.5){const f=n/0.5;raM=ra0+f*(ra1-ra0);decM=dec0+f*(dec1-dec0);}
      else{const f=(n-0.5)/0.5;raM=ra1+f*(ra2-ra1);decM=dec1+f*(dec2-dec1);}
      const theta=theta0+360.985647*m;let H=MoonCalc._fixangle(theta-lng-raM);if(H>180)H-=360;
      let deltaM;
      if(event==='transit'){deltaM=-H/360;}
      else{const sinH=Math.sin(r(lat))*Math.sin(r(decM))+Math.cos(r(lat))*Math.cos(r(decM))*Math.cos(r(H));
        const h=Math.asin(Math.max(-1,Math.min(1,sinH)))*180/Math.PI;
        const denom=360*Math.cos(r(decM))*Math.cos(r(lat))*Math.sin(r(H));
        if(Math.abs(denom)<1e-10)break;deltaM=(h-h0)/denom;}
      m+=deltaM;
    }
    return m*24;
  }

  _truePhaseJd(k,phaseType) {
    const T=k/1236.85;
    const jde=2451550.09766+29.530588861*k+0.00015437*T*T-0.00000015*T*T*T+0.00000000073*T*T*T*T;
    const r=a=>a*Math.PI/180;
    const M=r(MoonCalc._fixangle(2.5534+29.10535670*k-0.0000014*T*T-0.00000011*T*T*T));
    const Mp=r(MoonCalc._fixangle(201.5643+385.81693528*k+0.0107582*T*T+0.00001238*T*T*T));
    const F=r(MoonCalc._fixangle(160.7108+390.67050284*k-0.0016118*T*T-0.00000227*T*T*T));
    const om=r(MoonCalc._fixangle(124.7746-1.56375588*k+0.0020672*T*T+0.00000215*T*T*T));
    const E=1-0.002516*T-0.0000074*T*T;
    let c;
    if(phaseType===0||phaseType===0.5){
      const s=phaseType===0?[-0.40720,0.17241,0.01608,0.01039,0.00739,-0.00514,0.00208,-0.00111,-0.00057,0.00056,-0.00042,0.00042,0.00038,-0.00024,-0.00017]:[-0.40614,0.17302,0.01614,0.01043,0.00734,-0.00515,0.00209,-0.00111,-0.00057,0.00056,-0.00042,0.00042,0.00038,-0.00024,-0.00017];
      c=s[0]*Math.sin(Mp)+s[1]*E*Math.sin(M)+s[2]*Math.sin(2*Mp)+s[3]*Math.sin(2*F)+s[4]*E*Math.sin(Mp-M)+s[5]*E*Math.sin(Mp+M)+s[6]*E*E*Math.sin(2*M)+s[7]*Math.sin(Mp-2*F)+s[8]*Math.sin(Mp+2*F)+s[9]*E*Math.sin(2*Mp+M)+s[10]*Math.sin(3*Mp)+s[11]*E*Math.sin(M+2*F)+s[12]*E*Math.sin(M-2*F)+s[13]*E*Math.sin(2*Mp-M)+s[14]*Math.sin(om);
    } else {
      c=-0.62801*Math.sin(Mp)+0.17172*E*Math.sin(M)-0.01183*E*Math.sin(Mp+M)+0.00862*Math.sin(2*Mp)+0.00804*Math.sin(2*F)+0.00454*E*Math.sin(Mp-M)+0.00204*E*E*Math.sin(2*M)-0.00180*Math.sin(Mp-2*F)-0.00070*Math.sin(Mp+2*F)-0.00040*Math.sin(3*Mp)-0.00034*E*Math.sin(2*Mp-M)+0.00032*E*Math.sin(M+2*F)+0.00032*E*Math.sin(M-2*F)-0.00028*E*E*Math.sin(Mp+2*M)+0.00027*E*Math.sin(2*Mp+M)-0.00017*Math.sin(om);
      const W=0.00306-0.00038*E*Math.cos(M)+0.00026*Math.cos(Mp)-0.00002*Math.cos(Mp-M)+0.00002*Math.cos(Mp+M)+0.00002*Math.cos(2*F);
      c+=phaseType===0.25?W:-W;
    }
    return jde+c;
  }

  _previousNewMoon(d) {
    let search=new Date(d);search.setDate(search.getDate()-1);
    for(let i=0;i<35;i++){const nm=this.nextPhase(search,'new');if(nm>d){search.setDate(search.getDate()-30);continue;}return nm;}
    const phase=this.getPhase(d);const result=new Date(d);result.setDate(result.getDate()-Math.floor(phase.age));return result;
  }

  _parseDate(d) {
    if(d===null||d===undefined)return new Date();
    if(d instanceof Date)return d;
    if(typeof d==='string'){const [y,m,dy]=d.split('-').map(Number);return new Date(y,m-1,dy);}
    if(Array.isArray(d))return new Date(d[0],d[1]-1,d[2]);
    throw new Error(`Cannot parse date: ${d}`);
  }

  static _fixangle(a){a=a-360*Math.floor(a/360);return a<0?a+360:a;}
  static _julian(y,m,d){if(m<=2){y--;m+=12;}const A=Math.floor(y/100);return Math.floor(365.25*(y+4716))+Math.floor(30.6001*(m+1))+d+2-A+Math.floor(A/4)-1524.5;}
  static _jdToDate(jd){jd+=0.5;const Z=Math.floor(jd);let A;if(Z<2299161)A=Z;else{const al=Math.floor((Z-1867216.25)/36524.25);A=Z+1+al-Math.floor(al/4);}const B=A+1524,C=Math.floor((B-122.1)/365.25),D=Math.floor(365.25*C),E=Math.floor((B-D)/30.6001);return new Date(E<14?C-4716:C-4715,(E<14?E-1:E-13)-1,B-D-Math.floor(30.6001*E));}
  static _formatTime(h,fmt='24h'){if(h===null||isNaN(h))return'-----';if(fmt==='Float')return h;h=((h%24)+24)%24;let hr=Math.floor(h),mn=Math.round((h-hr)*60);if(mn>=60){hr++;mn-=60;}if(fmt==='12h')return`${(hr+11)%12+1}:${String(mn).padStart(2,'0')}${hr<12?'am':'pm'}`;return`${String(hr).padStart(2,'0')}:${String(mn).padStart(2,'0')}`;}
  _phaseName(phase){phase=((phase%1)+1)%1;const P=MoonCalc.PHASE_NAMES;for(let i=0;i<P.length-1;i++){const mid=(P[i][0]+P[i+1][0])/2;if(i===0&&phase<mid)return[P[0][1],P[0][2]];if(P[i][0]<=phase&&phase<P[i+1][0]){const idx=phase<mid?i:i+1;return[P[idx][1],P[idx][2]];}}return[P[P.length-1][1],P[P.length-1][2]];}
}

if(typeof module!=='undefined'&&module.exports)module.exports=MoonCalc;
if(typeof window!=='undefined')window.MoonCalc=MoonCalc;

// Test
if(typeof require!=='undefined'&&require.main===module){
  const mc=new MoonCalc();
  console.log('Moon Phase Calculator (JavaScript)');
  console.log('='.repeat(50));
  const phase=mc.getPhase();
  console.log(`\nToday: ${phase.emoji}  ${phase.name}`);
  console.log(`  Illumination:  ${(phase.illumination*100).toFixed(1)}%`);
  console.log(`  Age:           ${phase.age} days`);
  console.log(`  Distance:      ${phase.distance_km.toLocaleString()} km`);
  const rs=mc.getRiseSet(null,[45.52,-122.68],-8);
  console.log(`  Moonrise:      ${rs.rise||'N/A'}`);
  console.log(`  Moonset:       ${rs.set||'N/A'}`);
  console.log(`  Transit:       ${rs.transit||'N/A'}`);
  const hijri=mc.approxHijri();
  console.log(`  Hijri:         ${hijri.day} ${hijri.monthName} ${hijri.year} AH`);
  console.log('\nUpcoming phases:');
  for(const e of mc.nextPhases(null,8)){console.log(`  ${e.emoji}  ${e.date.toISOString().slice(0,10)}  ${e.name}`);}
}
