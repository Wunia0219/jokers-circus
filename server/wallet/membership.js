export const MEMBER_LEFT='member_left';
export const departureReason='Discord 已確認退群';
export const closedWalletId=(guild,user)=>'closed_'+guild+'_'+user;
export const dayCollection=wallet=>wallet?.sinceDeparture?'days-'+wallet.sinceDeparture:'days';
export const closedWallet=entry=>({guild:entry.guild,user:entry.user,balance:0,milestone:false,last_spin:0,closedAt:entry.id});
export const validDeparture=e=>e.kind===MEMBER_LEFT&&e.after===0&&e.delta===-e.before&&e.actor===null&&e.reference===null&&e.reason===departureReason;
