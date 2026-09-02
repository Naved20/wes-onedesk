import { supabase } from "@/integrations/supabase/client";

export type ActorType = 'user' | 'admin' | 'bot' | 'script' | 'system';
export type LogStatus = 'success' | 'failed' | 'warning';

export interface LogActivityParams {
  module: string;
  action: string;
  description?: string;
  actorType?: ActorType;
  actorEmail?: string;
  actorName?: string;
  actorId?: string;
  metadata?: Record<string, any>;
  status?: LogStatus;
}

let cachedIpAddress: string | null = null;

async function getClientIp(): Promise<string | null> {
  if (cachedIpAddress) return cachedIpAddress;
  if (typeof window === 'undefined') return null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);
    const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      if (data?.ip) {
        cachedIpAddress = data.ip;
        return cachedIpAddress;
      }
    }
  } catch (e) {
    // Fail silently without blocking logging
  }
  return null;
}

/**
 * Safely log an action performed by a user, admin, bot, script, or system.
 * Will NEVER throw errors or block primary application logic.
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    const {
      module,
      action,
      description,
      actorType: overrideActorType,
      actorEmail: overrideActorEmail,
      actorName: overrideActorName,
      actorId: overrideActorId,
      metadata = {},
      status = 'success',
    } = params;

    let actorId = overrideActorId || null;
    let actorEmail = overrideActorEmail || null;
    let actorName = overrideActorName || null;
    let actorType = overrideActorType || 'user';

    // Fetch IP address in background with timeout
    const ipAddress = await getClientIp();

    // Auto-detect user session if not explicitly provided as bot/script
    if (!overrideActorType || overrideActorType === 'user' || overrideActorType === 'admin') {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          actorId = session.user.id;
          actorEmail = session.user.email || null;
          actorName = session.user.user_metadata?.full_name || session.user.email || null;

          // Check if admin role
          if (!overrideActorType) {
            const { data: roles } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', session.user.id)
              .maybeSingle();

            if (roles?.role === 'admin') {
              actorType = 'admin';
            } else {
              actorType = 'user';
            }
          }
        } else if (!overrideActorType) {
          actorType = 'system';
        }
      } catch (e) {
        // Fallback gracefully
      }
    }

    // Insert log record silently
    await supabase.from('activity_logs' as any).insert({
      actor_id: actorId,
      actor_type: actorType,
      actor_email: actorEmail,
      actor_name: actorName,
      module,
      action,
      description: description || `${action} in ${module}`,
      metadata,
      status,
      ip_address: ipAddress,
      user_agent: typeof window !== 'undefined' ? window.navigator.userAgent : 'Server/Script',
    });

  } catch (error) {
    // Fail silently so user operations are never broken by logging failures
    console.warn('[ActivityLogger] Failed to save activity log:', error);
  }
}

/**
 * Convenience helper for logging Bot actions
 */
export async function logBotActivity(
  botName: string,
  module: string,
  action: string,
  description?: string,
  metadata?: Record<string, any>,
  status: LogStatus = 'success'
): Promise<void> {
  return logActivity({
    actorType: 'bot',
    actorName: botName,
    actorEmail: `${botName.toLowerCase().replace(/\s+/g, '_')}@bot.local`,
    module,
    action,
    description: description || `Bot [${botName}] executed ${action}`,
    metadata,
    status,
  });
}

/**
 * Convenience helper for logging Automated Script / Cron actions
 */
export async function logScriptActivity(
  scriptName: string,
  module: string,
  action: string,
  description?: string,
  metadata?: Record<string, any>,
  status: LogStatus = 'success'
): Promise<void> {
  return logActivity({
    actorType: 'script',
    actorName: scriptName,
    actorEmail: `${scriptName.toLowerCase().replace(/\s+/g, '_')}@script.local`,
    module,
    action,
    description: description || `Script [${scriptName}] executed ${action}`,
    metadata,
    status,
  });
}
