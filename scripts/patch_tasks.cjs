const fs = require('fs');
const path = require('path');

const tasksPath = path.join(__dirname, '../src/pages/Tasks.tsx');
let content = fs.readFileSync(tasksPath, 'utf8');

// 1. Add Tabs and Date imports
const importTarget = `import { ReactQuillWrapper } from "@/components/ui/react-quill-wrapper";`;
const importReplacement = `import { ReactQuillWrapper } from "@/components/ui/react-quill-wrapper";\nimport { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";\nimport { startOfMonth, endOfMonth, parseISO } from "date-fns";`;
content = content.replace(importTarget, importReplacement);

// 2. Change state variables
const stateTarget = `  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [sortField, setSortField] = useState<string>("created_at");`;

const stateReplacement = `  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), "yyyy-MM"));
  const [activeTab, setActiveTab] = useState<string>("Upcoming");
  const [sortField, setSortField] = useState<string>("created_at");`;
content = content.replace(stateTarget, stateReplacement);

// 3. Update useEffect dependencies
const effectTarget = `    // Fetch total earnings for employees
    if (role === "employee" && user?.id) {
      fetchTotalEarnings();
    }
  }, [role, user?.id]);`;
const effectReplacement = `    // Fetch total earnings for employees
    if (role === "employee" && user?.id) {
      fetchTotalEarnings();
    }
  }, [role, user?.id, selectedMonth]);`;
content = content.replace(effectTarget, effectReplacement);

// 4. Update fetchTasks function
const fetchTarget = `  const fetchTasks = async (reset: boolean = false) => {
    try {
      if (reset) {
        setLoading(true);
        setPage(0);
        setHasMore(true);
      } else {
        setLoadingMore(true);
      }

      const currentPage = reset ? 0 : page;
      const from = currentPage * TASKS_PER_PAGE;
      const to = from + TASKS_PER_PAGE - 1;

      let query;
      
      if (role === "admin") {
        // Admin sees all tasks
        query = supabase
          .from("tasks" as any)
          .select("*", { count: 'exact' })
          .eq("is_active", true)
          .order("display_order", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false })
          .range(from, to);
      } else {
        // Employees and managers only see tasks assigned to them
        const { data: assignedTasks, error: assignError } = await supabase
          .from("task_assignments" as any)
          .select("task_id")
          .eq("user_id", user?.id);

        if (assignError) throw assignError;

        const taskIds = (assignedTasks || []).map((a: any) => a.task_id);

        if (taskIds.length === 0) {
          setTasks([]);
          setHasMore(false);
          setLoading(false);
          setLoadingMore(false);
          return;
        }

        query = supabase
          .from("tasks" as any)
          .select("*", { count: 'exact' })
          .in("id", taskIds)
          .eq("is_active", true)
          .order("display_order", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false })
          .range(from, to);
      }

      const { data, error, count } = await query;

      if (error) throw error;
      
      const newTasks = (data || []) as Task[];
      
      if (reset) {
        setTasks(newTasks);
      } else {
        setTasks(prev => [...prev, ...newTasks]);
      }
      
      // Check if there are more tasks to load
      const totalLoaded = reset ? newTasks.length : tasks.length + newTasks.length;
      setHasMore(count ? totalLoaded < count : newTasks.length === TASKS_PER_PAGE);
      
      if (!reset) {
        setPage(currentPage + 1);
      } else {
        setPage(1);
      }`;

const fetchReplacement = `  const fetchTasks = async (reset: boolean = false) => {
    try {
      if (reset) {
        setLoading(true);
      }

      const [year, month] = selectedMonth.split('-');
      const dateForMonth = new Date(parseInt(year), parseInt(month) - 1, 1);
      const start = startOfMonth(dateForMonth).toISOString();
      const end = endOfMonth(dateForMonth).toISOString();

      let query;
      
      if (role === "admin") {
        // Admin sees all tasks
        query = supabase
          .from("tasks" as any)
          .select("*")
          .eq("is_active", true)
          .gte("created_at", start)
          .lte("created_at", end)
          .order("display_order", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false });
      } else {
        // Employees and managers only see tasks assigned to them
        const { data: assignedTasks, error: assignError } = await supabase
          .from("task_assignments" as any)
          .select("task_id")
          .eq("user_id", user?.id);

        if (assignError) throw assignError;

        const taskIds = (assignedTasks || []).map((a: any) => a.task_id);

        if (taskIds.length === 0) {
          setTasks([]);
          setHasMore(false);
          setLoading(false);
          setLoadingMore(false);
          return;
        }

        query = supabase
          .from("tasks" as any)
          .select("*")
          .in("id", taskIds)
          .eq("is_active", true)
          .gte("created_at", start)
          .lte("created_at", end)
          .order("display_order", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false });
      }

      const { data, error } = await query;

      if (error) throw error;
      
      const newTasks = (data || []) as Task[];
      
      setTasks(newTasks);
      setHasMore(false);`;
content = content.replace(fetchTarget, fetchReplacement);

// 5. Replace UI Filter Section and add Tabs
const uiTarget = `              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search tasks by title or description..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex gap-2">
                  <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Filter by Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="English Reading, listening & speaking Task">English Reading</SelectItem>
                      <SelectItem value="Lesson Plan & Delivery">Lesson Plan</SelectItem>
                      <SelectItem value="Soft & Digital Skills">Soft & Digital</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-[200px]">
                      <Filter className="mr-2 h-4 w-4" />
                      <SelectValue placeholder="Filter by Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="Soft Skills">Soft Skills</SelectItem>
                      <SelectItem value="Hindi">Hindi</SelectItem>
                      <SelectItem value="English">English</SelectItem>
                      <SelectItem value="Mathematics">Mathematics</SelectItem>
                      <SelectItem value="Science">Science</SelectItem>
                      <SelectItem value="Social Studies">Social Studies</SelectItem>
                      <SelectItem value="Computer Science">Computer Science</SelectItem>
                      <SelectItem value="Arts & Crafts">Arts & Crafts</SelectItem>
                      <SelectItem value="Physical Education">Physical Education</SelectItem>
                      <SelectItem value="General">General</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={sortField} onValueChange={(value) => {
                    setSortField(value);
                    setSortDirection("desc");
                  }}>
                    <SelectTrigger className="w-[180px]">
                      <ArrowUpDown className="mr-2 h-4 w-4" />
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created_at">Created Date</SelectItem>
                      <SelectItem value="title">Title</SelectItem>
                      <SelectItem value="due_date">Due Date</SelectItem>
                      <SelectItem value="reward_amount">Reward</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")}
                    title={sortDirection === "asc" ? "Ascending" : "Descending"}
                  >
                    {sortDirection === "asc" ? "↑" : "↓"}
                  </Button>
                </div>
              </div>
              {(searchQuery || selectedCategory !== "all" || selectedType !== "all") && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCategory("all");
                    setSelectedType("all");
                  }}
                  className="w-fit"
                >
                  Clear Filters
                </Button>
              )}`;

const uiReplacement = `              <div className="flex flex-col sm:flex-row gap-4 justify-between items-center w-full mb-4">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
                  <TabsList className="grid w-full sm:w-auto grid-cols-2 md:grid-cols-4 lg:inline-flex bg-muted/50 p-1 rounded-lg">
                    <TabsTrigger value="Upcoming" className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-md px-4 py-2 text-sm font-medium transition-all">Upcoming</TabsTrigger>
                    <TabsTrigger value="Submitted / Pending Review" className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-md px-4 py-2 text-sm font-medium transition-all">Submitted / Pending Review</TabsTrigger>
                    <TabsTrigger value="Complete" className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-md px-4 py-2 text-sm font-medium transition-all">Complete</TabsTrigger>
                    <TabsTrigger value="Missed" className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-md px-4 py-2 text-sm font-medium transition-all">Missed</TabsTrigger>
                  </TabsList>
                </Tabs>
                <div className="flex items-center gap-2">
                  <Label htmlFor="month-selector" className="whitespace-nowrap font-medium text-sm">Month:</Label>
                  <Input 
                    id="month-selector"
                    type="month" 
                    value={selectedMonth} 
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-[180px]"
                  />
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 w-full">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search tasks by title or description..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex gap-2">
                  <Select value={sortField} onValueChange={(value) => {
                    setSortField(value);
                    setSortDirection("desc");
                  }}>
                    <SelectTrigger className="w-[180px]">
                      <ArrowUpDown className="mr-2 h-4 w-4" />
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created_at">Created Date</SelectItem>
                      <SelectItem value="title">Title</SelectItem>
                      <SelectItem value="due_date">Due Date</SelectItem>
                      <SelectItem value="reward_amount">Reward</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")}
                    title={sortDirection === "asc" ? "Ascending" : "Descending"}
                  >
                    {sortDirection === "asc" ? "↑" : "↓"}
                  </Button>
                </div>
              </div>
              {searchQuery && (
                <Button
                  variant="ghost"
                  onClick={() => setSearchQuery("")}
                  className="w-fit"
                >
                  Clear Search
                </Button>
              )}`;
content = content.replace(uiTarget, uiReplacement);

// 6. Replace Filter logic
const filterTarget = `              // Filter tasks based on search query, type, and category
              let filteredTasks = tasks.filter((task) => {
                // Search filter
                const matchesSearch = searchQuery.trim() === "" || 
                  task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  task.description.toLowerCase().includes(searchQuery.toLowerCase());
                
                // Type filter
                const matchesType = selectedType === "all" || 
                  task.type === selectedType;
                
                // Category filter
                const matchesCategory = selectedCategory === "all" || 
                  task.category === selectedCategory;
                
                return matchesSearch && matchesType && matchesCategory;
              });`;

const filterReplacement = `              // Filter tasks based on active tab and search query
              let filteredTasks = tasks.filter((task) => {
                // Search filter
                const matchesSearch = searchQuery.trim() === "" || 
                  task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  task.description.toLowerCase().includes(searchQuery.toLowerCase());
                
                if (!matchesSearch) return false;

                const taskResponses = responses[task.id] || [];
                // Admin can see the global status based on their own response if they responded,
                // otherwise we assume it's for them personally.
                const userResponse = taskResponses.find(r => r.user_id === user?.id);
                const taskRemarks = userResponse ? (remarks[userResponse.id] || []) : [];
                const hasRemark = taskRemarks.length > 0;
                const isPastDue = task.due_date ? new Date(task.due_date) < new Date() : false;

                let taskStatus = "Upcoming";
                if (userResponse && hasRemark) {
                  taskStatus = "Complete";
                } else if (userResponse && !hasRemark) {
                  taskStatus = "Submitted / Pending Review";
                } else if (!userResponse && isPastDue) {
                  taskStatus = "Missed";
                }

                return activeTab === taskStatus;
              });`;

content = content.replace(filterTarget, filterReplacement);

// 7. Remove infinite scroll div at the end since we removed pagination
const loaderTarget = `            {/* Infinite scroll loader */}
            {hasMore && (
              <div ref={loaderRef} className="py-4 flex justify-center">
                {loadingMore && <div className="text-sm text-muted-foreground">Loading more tasks...</div>}
              </div>
            )}`;
content = content.replace(loaderTarget, "");

fs.writeFileSync(tasksPath, content);
console.log("Patch complete!");
