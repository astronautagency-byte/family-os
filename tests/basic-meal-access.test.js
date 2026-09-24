import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

test('Free members can manage meals but cannot access another household',async()=>{
 const db=new PGlite();
 try {
 await db.exec(`create role authenticated;
 create table meals(id int primary key,household_id int,title text);
 alter table meals enable row level security;
 grant select,insert,update,delete on meals to authenticated;
 create function is_household_member(h int) returns boolean language sql as $$select h=1$$;
 create function has_household_feature(h int,f text) returns boolean language sql as $$select false$$;
 create policy "entitled household meals" on meals for all to authenticated using(is_household_member(household_id) and has_household_feature(household_id,'meals')) with check(is_household_member(household_id) and has_household_feature(household_id,'meals'));
 insert into meals values(2,2,'Private');`);
 await db.exec(readFileSync(new URL('../supabase/migrations/202609240001_free_basic_meal_planning.sql',import.meta.url),'utf8'));
 await db.exec('set role authenticated');
 await db.exec("insert into meals values(1,1,'Breakfast')");
 await db.exec("insert into meals values(1,1,'Lunch') on conflict(id) do update set title=excluded.title");
 assert.deepEqual((await db.query('select title from meals')).rows,[{title:'Lunch'}]);
 await assert.rejects(db.exec("insert into meals values(3,2,'Forbidden')"),/row-level security/);
 await assert.rejects(db.exec('update meals set household_id=2 where id=1'),/row-level security/);
 assert.equal((await db.query("select has_household_feature(1,'meals') as premium")).rows[0].premium,false);
 await db.exec('delete from meals where id=1');
 assert.equal((await db.query('select * from meals')).rows.length,0);
 } finally {await db.close();}
});
