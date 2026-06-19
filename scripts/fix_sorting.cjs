const fs = require('fs');
let code = fs.readFileSync('src/pages/Tasks.tsx', 'utf8');

// 1. Change default state
const stateTarget = `  const [sortField, setSortField] = useState<string>("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");`;
const stateReplacement = `  const [sortField, setSortField] = useState<string>("display_order");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");`;
code = code.replace(stateTarget, stateReplacement);

// 2. Add 'display_order' to switch case
const switchTarget = `                switch (sortField) {
                  case "title":`;
const switchReplacement = `                switch (sortField) {
                  case "display_order":
                    aValue = a.display_order ?? 999999;
                    bValue = b.display_order ?? 999999;
                    break;
                  case "title":`;
code = code.replace(switchTarget, switchReplacement);

// 3. Add to dropdown
const dropdownTarget = `                      <SelectItem value="created_at">Created Date</SelectItem>
                      <SelectItem value="title">Title</SelectItem>
                      <SelectItem value="due_date">Due Date</SelectItem>
                      <SelectItem value="reward_amount">Reward</SelectItem>`;
const dropdownReplacement = `                      <SelectItem value="display_order">Custom Order</SelectItem>
                      <SelectItem value="created_at">Created Date</SelectItem>
                      <SelectItem value="title">Title</SelectItem>
                      <SelectItem value="due_date">Due Date</SelectItem>
                      <SelectItem value="reward_amount">Reward</SelectItem>`;
code = code.replace(dropdownTarget, dropdownReplacement);

fs.writeFileSync('src/pages/Tasks.tsx', code);
console.log("Sorting fixed!");
