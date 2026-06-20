const fs = require('fs');
let code = fs.readFileSync('src/hooks/useAuth.tsx', 'utf8');

if (!code.includes('import { toast }')) {
  code = code.replace(
    'import { Database } from "@/integrations/supabase/types";',
    'import { Database } from "@/integrations/supabase/types";\nimport { toast } from "@/hooks/use-toast";'
  );
}

const oldFetchUserInstitution = `  const fetchUserInstitution = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("employee_profiles")
        .select("institution_assignment")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching user institution:", error);
      } else if (data) {
        setInstitution(data.institution_assignment);
      }
    } catch (error) {
      console.error("Error fetching user institution:", error);
    }
  };`;

const newFetchUserInstitution = `  const fetchUserInstitution = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("employee_profiles")
        .select("institution_assignment, is_active")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching user institution:", error);
      } else if (data) {
        if (data.is_active === false) {
          await supabase.auth.signOut();
          setUser(null);
          setSession(null);
          setRole(null);
          toast({
            title: "Session Expired",
            description: "Your account has been deactivated by an administrator.",
            variant: "destructive",
          });
          return;
        }
        setInstitution(data.institution_assignment);
      }
    } catch (error) {
      console.error("Error fetching user institution:", error);
    }
  };`;

code = code.replace(oldFetchUserInstitution, newFetchUserInstitution);

const oldSignIn = `  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error: error as Error | null };
    } catch (error) {
      return { error: error as Error };
    }
  };`;

const newSignIn = `  const signIn = async (email: string, password: string) => {
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (authData?.user) {
        const { data: profile } = await supabase
          .from("employee_profiles")
          .select("is_active")
          .eq("user_id", authData.user.id)
          .single();
          
        if (profile && profile.is_active === false) {
          await supabase.auth.signOut();
          return { error: new Error("Account has been deactivated. Please contact admin.") };
        }
      }
      
      return { error: error as Error | null };
    } catch (error) {
      return { error: error as Error };
    }
  };`;

code = code.replace(oldSignIn, newSignIn);

fs.writeFileSync('src/hooks/useAuth.tsx', code);
console.log("Updated useAuth.tsx successfully");
