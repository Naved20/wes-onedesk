const fs = require('fs');
let code = fs.readFileSync('src/pages/Tasks.tsx', 'utf8');

const fetchBatchDataDef = `
  const fetchBatchData = async (taskIds: string[]) => {
    if (!taskIds.length) return;
    
    try {
      // 1. Fetch Assignments
      const { data: assignmentsData } = await supabase
        .from("task_assignments")
        .select("task_id, user_id")
        .in("task_id", taskIds);
      
      // 2. Fetch Responses
      const { data: responsesData } = await supabase
        .from("task_responses")
        .select("*")
        .in("task_id", taskIds);
        
      // 3. Fetch Remarks
      const responseIds = (responsesData || []).map((r: any) => r.id);
      
      // Chunk responseIds to avoid too large query
      let remarksData: any[] = [];
      if (responseIds.length > 0) {
        const chunkSize = 150;
        for (let i = 0; i < responseIds.length; i += chunkSize) {
          const chunk = responseIds.slice(i, i + chunkSize);
          const { data } = await supabase.from("task_remarks").select("*").in("response_id", chunk);
          if (data) remarksData = [...remarksData, ...data];
        }
      }
        
      // 4. Fetch Profiles
      const userIds = new Set<string>();
      (assignmentsData || []).forEach((a: any) => userIds.add(a.user_id));
      (responsesData || []).forEach((r: any) => userIds.add(r.user_id));
      (remarksData || []).forEach((r: any) => userIds.add(r.remarked_by));
      
      const userIdsArr = Array.from(userIds);
      let profilesData: any[] = [];
      if (userIdsArr.length > 0) {
        const chunkSize = 150;
        for (let i = 0; i < userIdsArr.length; i += chunkSize) {
          const chunk = userIdsArr.slice(i, i + chunkSize);
          const { data } = await supabase.from("employee_profiles").select("user_id, first_name, last_name").in("user_id", chunk);
          if (data) profilesData = [...profilesData, ...data];
        }
      }
      const profileMap = new Map();
      profilesData.forEach(p => profileMap.set(p.user_id, p));
      
      // Group assignments
      const newAssignments: Record<string, any[]> = {};
      (assignmentsData || []).forEach((a: any) => {
        if (!newAssignments[a.task_id]) newAssignments[a.task_id] = [];
        const p = profileMap.get(a.user_id) || { first_name: "Unknown", last_name: "User" };
        newAssignments[a.task_id].push({ user_id: a.user_id, first_name: p.first_name, last_name: p.last_name });
      });
      setAssignments(prev => ({ ...prev, ...newAssignments }));
      
      // Group responses
      const newResponses: Record<string, any[]> = {};
      (responsesData || []).forEach((r: any) => {
        if (!newResponses[r.task_id]) newResponses[r.task_id] = [];
        const p = profileMap.get(r.user_id) || { first_name: "Unknown", last_name: "User" };
        newResponses[r.task_id].push({ ...r, employee_profiles: p });
      });
      setResponses(prev => ({ ...prev, ...newResponses }));
      
      // Group remarks
      const newRemarks: Record<string, any[]> = {};
      (remarksData || []).forEach((r: any) => {
        if (!newRemarks[r.response_id]) newRemarks[r.response_id] = [];
        const p = profileMap.get(r.remarked_by) || { first_name: "Unknown", last_name: "User" };
        newRemarks[r.response_id].push({ ...r, employee_profiles: p });
      });
      setRemarks(prev => ({ ...prev, ...newRemarks }));
      
      // 5. Peer Reviewers
      const { data: peerData } = await supabase.from("task_peer_reviewers").select("task_id, user_id").in("task_id", taskIds);
      const newPeers: Record<string, any[]> = {};
      (peerData || []).forEach((p: any) => {
        if (!newPeers[p.task_id]) newPeers[p.task_id] = [];
        const prof = profileMap.get(p.user_id) || { first_name: "Unknown", last_name: "User" };
        newPeers[p.task_id].push({ user_id: p.user_id, first_name: prof.first_name, last_name: prof.last_name });
      });
      setPeerReviewers(prev => ({ ...prev, ...newPeers }));
      
    } catch (e) {
      console.error("Batch fetch error", e);
    }
  };

  const fetchTasks = async () => {`;

code = code.replace(`  const fetchTasks = async () => {`, fetchBatchDataDef);

const oldFetchCall = `      // Fetch responses and assignments in parallel for better performance
      if (newTasks && newTasks.length > 0) {
        const taskIds = newTasks.map(task => task.id);
        
        // Fetch all responses in one query
        Promise.all(taskIds.map(id => fetchResponses(id))).catch(console.error);
        
        // Fetch all assignments in one query
        Promise.all(taskIds.map(id => fetchAssignments(id))).catch(console.error);

        // Fetch peer reviewers
        Promise.all(taskIds.map(id => fetchPeerReviewers(id))).catch(console.error);
      }`;

const newFetchCall = `      // Fetch responses and assignments in batched queries for better performance
      if (newTasks && newTasks.length > 0) {
        const taskIds = newTasks.map(task => task.id);
        fetchBatchData(taskIds).catch(console.error);
      }`;

if (code.includes(oldFetchCall)) {
  code = code.replace(oldFetchCall, newFetchCall);
  fs.writeFileSync('src/pages/Tasks.tsx', code);
  console.log("Successfully replaced N+1 queries with batch fetch!");
} else {
  console.log("Could not find fetch call block.");
}
