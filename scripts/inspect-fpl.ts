import fs from 'fs';
const d = JSON.parse(fs.readFileSync('/tmp/fpl_test.json', 'utf8'));

console.log('=== EVENTS (gameweeks) ===');
d.events.forEach((e: any) => {
  if (e.is_current || e.is_next || e.is_finished) {
    console.log(`GW${e.id} ${e.name} | finished=${e.finished} current=${e.is_current} next=${e.is_next} | deadline=${e.deadline_time}`);
  }
});
const cur = d.events.find((e: any) => e.is_current || e.is_next);
console.log('FOCUS GW:', cur?.id, cur?.name);

console.log('\n=== TEAMS ===');
console.log('count:', d.teams.length);
d.teams.slice(0, 5).forEach((t: any) =>
  console.log(t.id, t.short_name, t.name, 'strength:', t.strength)
);

console.log('\n=== SAMPLE PLAYER (Salah) ===');
const salah = d.elements.find((p: any) => p.web_name === 'Salah');
if (salah) {
  const keys = ['id', 'web_name', 'team', 'element_type', 'now_cost', 'form', 'points_per_game', 'minutes', 'goals_scored', 'assists', 'expected_goals', 'expected_assists', 'ict_index', 'influence', 'creativity', 'threat', 'selected_by_percent', 'status', 'chance_of_playing_this_round', 'news', 'photo', 'value_form', 'bps', 'bonus', 'transfers_in'];
  keys.forEach((k) => console.log(`  ${k}: ${salah[k]}`));
}

console.log('\n=== ELEMENT COUNT ===', d.elements.length);
console.log('=== POSITIONS ===');
d.element_types.forEach((t: any) => console.log(t.id, t.singular_name_short, 'squad_select:', t.squad_select));

console.log('\n=== FIELDS of elements (union of interesting) ===');
console.log(Object.keys(d.elements[0]).join(', '));
