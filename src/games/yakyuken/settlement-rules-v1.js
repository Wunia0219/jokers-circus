// Published settlements and backups continue to use this table after future rule changes.
export const DUEL_RULE_VERSION=1;
export const DUEL_ENTRY_FEE=1000;
export const DUEL_RULES=Object.freeze({
  dealer:Object.freeze({winsRequired:2,lossLimit:2,reward:2500,winWeight:3189,lossWeight:4811}),
  'guest-1':Object.freeze({winsRequired:3,lossLimit:2,reward:5000,winWeight:3135,lossWeight:4865}),
  'guest-2':Object.freeze({winsRequired:5,lossLimit:3,reward:10000,winWeight:3057,lossWeight:4943}),
  'guest-3':Object.freeze({winsRequired:7,lossLimit:3,reward:25000,winWeight:3299,lossWeight:4701}),
  'guest-4':Object.freeze({winsRequired:9,lossLimit:4,reward:50000,winWeight:3022,lossWeight:4978}),
});
