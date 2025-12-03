import { supabase } from "@/integrations/supabase/client";

type EventType = 'registro' | 'login' | 'logout';
type Status = 'exitoso' | 'fallido';

interface LogAccessParams {
  userId?: string;
  userName?: string;
  userEmail: string;
  userRole?: string;
  eventType: EventType;
  status: Status;
  details?: string;
}

export const logAccess = async (params: LogAccessParams): Promise<void> => {
  try {
    const { error } = await supabase.functions.invoke('log-access', {
      body: params,
    });

    if (error) {
      console.error('Error logging access:', error);
    }
  } catch (error) {
    // Silent fail - don't interrupt user flow for logging errors
    console.error('Failed to log access event:', error);
  }
};

export const useAccessLog = () => {
  return { logAccess };
};
