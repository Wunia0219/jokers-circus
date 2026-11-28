// A portable SQLite archive retains one wallet row per ledger owner for its foreign keys.
// Expose only the current lifetime when a restored archive is opened as a local wallet.
export function membershipViews(db){
  if(!db.prepare("SELECT 1 FROM ledger WHERE kind='member_left' LIMIT 1").get())
    return {wallets:'wallets',rounds:'rounds',ledger:'ledger'};
  db.exec(`
    CREATE TEMP TABLE departures(guild TEXT,user TEXT,revision INTEGER,PRIMARY KEY(guild,user));
    INSERT INTO departures SELECT guild,user,MAX(id) FROM ledger WHERE kind='member_left' GROUP BY guild,user;
    CREATE TEMP TABLE archived_rounds(guild TEXT,user TEXT,id TEXT,PRIMARY KEY(guild,user,id));
    INSERT INTO archived_rounds SELECT l.guild,l.user,json_extract(o.result,'$.round.id')
      FROM departures d JOIN ledger l ON l.guild=d.guild AND l.user=d.user AND l.id<=d.revision AND l.kind='spin'
      JOIN operations o ON o.guild=l.guild AND o.key='spin:'||l.user||':'||l.reference;
    CREATE TEMP VIEW current_wallets AS SELECT w.* FROM wallets w LEFT JOIN departures d USING(guild,user)
      WHERE d.revision IS NULL OR EXISTS(SELECT 1 FROM ledger l WHERE l.guild=w.guild AND l.user=w.user AND l.id>d.revision);
    CREATE TEMP VIEW current_rounds AS SELECT r.rowid AS rowid,r.* FROM rounds r
      WHERE NOT EXISTS(SELECT 1 FROM archived_rounds a WHERE a.guild=r.guild AND a.user=r.user AND a.id=r.id);
    CREATE TEMP VIEW current_ledger AS SELECT l.* FROM ledger l LEFT JOIN departures d USING(guild,user)
      WHERE d.revision IS NULL OR l.id>d.revision;
  `);
  return {wallets:'current_wallets',rounds:'current_rounds',ledger:'current_ledger',restored:true};
}
