import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  'https://glijytescdhdtihzlhlg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsaWp5dGVzY2RoZHRpaHpsaGxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MjYyNjAsImV4cCI6MjA4MjQwMjI2MH0.DUdN4cN3miY7TFmW41sfbnPzqVlyYrffHImOKvPsQkI'
);
const { data, error } = await supabase.from('tasks').select('id,title,description').like('title','Day %- Task %').order('title');
if (error) { console.error(error); process.exit(1); }
console.log('Got', data.length);
import fs from 'fs';
fs.writeFileSync('/tmp/tasks/raw.json', JSON.stringify(data));
