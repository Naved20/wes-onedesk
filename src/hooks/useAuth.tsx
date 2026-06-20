import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { toast } from "@/hooks/use-toast";
import { initializeFirebaseMessaging } from "@/lib/firebaseMessaging";
import { requestNotificationPermission, setupRealtimeNotifications, stopRealtimeNotifications } from "@/lib/simpleNotificationService";

type AppRole = Database["public"]["Enums"]["app_role"];

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  institution: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [institution, setInstitution] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer role fetching with setTimeout
        if (session?.user) {
          setTimeout(() => {
            fetchUserRole(session.user.id);
            fetchUserInstitution(session.user.id);
            // Initialize Firebase Messaging for push notifications
            initializeFirebaseMessaging().catch(err => 
              console.error("Firebase messaging setup failed:", err)
            );
            // Setup real-time browser notifications
            requestNotificationPermission().then(granted => {
              if (granted) {
                setupRealtimeNotifications(session.user.id);
                console.log("Real-time notifications enabled");
              }
            });
          }, 0);
        } else {
          setRole(null);
          setInstitution(null);
          // Stop listening to notifications when logged out
          if (user?.id) {
            stopRealtimeNotifications(user.id);
          }
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserRole(session.user.id);
        fetchUserInstitution(session.user.id);
        // Initialize Firebase Messaging for push notifications
        initializeFirebaseMessaging().catch(err => 
          console.error("Firebase messaging setup failed:", err)
        );
        // Setup real-time browser notifications
        requestNotificationPermission().then(granted => {
          if (granted) {
            setupRealtimeNotifications(session.user.id);
            console.log("Real-time notifications enabled");
          }
        });
      } else {
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      if (user?.id) {
        stopRealtimeNotifications(user.id);
      }
    };
  }, []);

  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching user role:", error);
      } else if (data) {
        setRole(data.role);
      } else {
        // Default to employee if no role found
        setRole("employee");
      }
    } catch (error) {
      console.error("Error fetching user role:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserInstitution = async (userId: string) => {
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
  };

  const signIn = async (email: string, password: string) => {
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
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, role, institution, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
