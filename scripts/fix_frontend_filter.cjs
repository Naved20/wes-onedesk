const fs = require('fs');
let code = fs.readFileSync('src/pages/Tasks.tsx', 'utf8');

const target = `                if (!matchesSearch) return false;

                const taskResponses = responses[task.id] || [];`;

const replacement = `                if (!matchesSearch) return false;

                // Month filter
                if (selectedMonth) {
                  const [year, month] = selectedMonth.split('-');
                  const selectedMonthInt = parseInt(month);
                  const selectedYearInt = parseInt(year);
                  const taskDate = task.due_date ? new Date(task.due_date) : new Date(task.created_at);
                  if (taskDate.getMonth() + 1 !== selectedMonthInt || taskDate.getFullYear() !== selectedYearInt) {
                    return false;
                  }
                }

                const taskResponses = responses[task.id] || [];`;

code = code.replace(target, replacement);

fs.writeFileSync('src/pages/Tasks.tsx', code);
console.log('Added frontend month filter');
