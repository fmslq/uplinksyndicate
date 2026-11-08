// Однократный перенос прогресса r2p22 на новую кривую. Игрок не теряет
// процент текущего района; XP аккаунта, деньги, предметы и история не меняются.
import {CONFIG, BONUS_K, districtThr} from './config.js';
const OLD_DAYS=[1,1.14,1.45,1.61,1.96,2.53,2.86,3.4,4.25,4.76,6.09,7.13];
export const oldDistrictThr=d=>{const i=Math.max(0,Math.min(11,(d|0)-1));return Math.round(OLD_DAYS[i]*3500*CONFIG.districts[i][3]*BONUS_K[i])};
function migrateState(g){if(!g||typeof g!=='object')return;const d=Math.max(1,Math.min(12,g.district|0||1)),old=oldDistrictThr(d),next=districtThr(d),k=next/old;
 for(const f of ['dxp','keyHold','laterHold','carry'])if(Number.isFinite(g[f])&&g[f]>0){const n=g[f];g[f]=f==='dxp'&&d>=CONFIG.finishFromDistrict&&n===old-1?next-1:Math.round(n*k)}}
export function migrateBalance(root){if((root.balanceVersion|0)>=1)return false;const g=root.game;if(g&&typeof g==='object'){
 migrateState(g);for(const u of Array.isArray(g.undo)?g.undo:[]){if(typeof u.before!=='string')continue;try{const before=JSON.parse(u.before);if(before&&typeof before==='object'){migrateState(before);u.before=JSON.stringify(before)}}catch{}}
 }root.balanceVersion=1;return !!g}
