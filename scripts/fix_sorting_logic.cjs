const fs = require('fs');
let code = fs.readFileSync('src/pages/Tasks.tsx', 'utf8');

const oldSort = `              // Sort tasks
              filteredTasks = [...filteredTasks].sort((a, b) => {
                let aValue: any;
                let bValue: any;

                switch (sortField) {
                  case "display_order":
                    aValue = a.display_order ?? 999999;
                    bValue = b.display_order ?? 999999;
                    break;
                  case "title":
                    aValue = a.title.toLowerCase();
                    bValue = b.title.toLowerCase();
                    break;
                  case "type":
                    aValue = (a.type || "").toLowerCase();
                    bValue = (b.type || "").toLowerCase();
                    break;
                  case "category":
                    aValue = (a.category || "").toLowerCase();
                    bValue = (b.category || "").toLowerCase();
                    break;
                  case "due_date":
                    aValue = a.due_date ? new Date(a.due_date).getTime() : 0;
                    bValue = b.due_date ? new Date(b.due_date).getTime() : 0;
                    break;
                  case "reward_amount":
                    aValue = a.reward_amount || 0;
                    bValue = b.reward_amount || 0;
                    break;
                  case "status":
                    aValue = a.is_active ? 1 : 0;
                    bValue = b.is_active ? 1 : 0;
                    break;
                  case "completion": {
                    const ca = (assignments[a.id]?.length || 0);
                    const cb = (assignments[b.id]?.length || 0);
                    aValue = ca ? ((responses[a.id]?.length || 0) / ca) : 0;
                    bValue = cb ? ((responses[b.id]?.length || 0) / cb) : 0;
                    break;
                  }
                  case "created_at":
                  default:
                    aValue = new Date(a.created_at).getTime();
                    bValue = new Date(b.created_at).getTime();
                    break;
                }

                if (sortDirection === "asc") {
                  return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
                } else {
                  return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
                }
              });`;

const newSort = `              // Sort tasks
              filteredTasks = [...filteredTasks].sort((a, b) => {
                let aValue: any;
                let bValue: any;

                switch (sortField) {
                  case "display_order":
                    aValue = a.display_order ?? 999999;
                    bValue = b.display_order ?? 999999;
                    break;
                  case "title":
                    aValue = (a.title || "").toLowerCase();
                    bValue = (b.title || "").toLowerCase();
                    break;
                  case "type":
                    aValue = (a.type || "").toLowerCase();
                    bValue = (b.type || "").toLowerCase();
                    break;
                  case "category":
                    aValue = (a.category || "").toLowerCase();
                    bValue = (b.category || "").toLowerCase();
                    break;
                  case "due_date":
                    aValue = a.due_date ? new Date(a.due_date).getTime() : 0;
                    bValue = b.due_date ? new Date(b.due_date).getTime() : 0;
                    break;
                  case "reward_amount":
                    aValue = a.reward_amount || 0;
                    bValue = b.reward_amount || 0;
                    break;
                  case "status":
                    if (role === "employee") {
                      aValue = getTaskStatus(a).toLowerCase();
                      bValue = getTaskStatus(b).toLowerCase();
                    } else {
                      aValue = a.is_active ? 1 : 0;
                      bValue = b.is_active ? 1 : 0;
                    }
                    break;
                  case "completion": {
                    const ca = (assignments[a.id]?.length || 0);
                    const cb = (assignments[b.id]?.length || 0);
                    aValue = ca ? ((responses[a.id]?.length || 0) / ca) : 0;
                    bValue = cb ? ((responses[b.id]?.length || 0) / cb) : 0;
                    break;
                  }
                  case "created_at":
                  default:
                    aValue = a.created_at ? new Date(a.created_at).getTime() : 0;
                    bValue = b.created_at ? new Date(b.created_at).getTime() : 0;
                    break;
                }

                if (aValue === bValue) return 0;
                
                if (sortDirection === "asc") {
                  return aValue > bValue ? 1 : -1;
                } else {
                  return aValue < bValue ? 1 : -1;
                }
              });`;

if(code.includes(oldSort)) {
  code = code.replace(oldSort, newSort);
  fs.writeFileSync('src/pages/Tasks.tsx', code);
  console.log("Successfully replaced sort logic.");
} else {
  console.log("Could not find old sort block!");
}
