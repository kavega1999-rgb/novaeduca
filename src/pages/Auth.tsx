import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Power, ArrowLeft, Mail } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { logAccess } from "@/hooks/useAccessLog";
import heroImage from "@/assets/team-celebration.jpg";

type AuthView = "main" | "otp-verify" | "forgot-password" | "reset-password";

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [area, setArea] = useState<"medicos" | "asistencial" | "administrativos" | "">("");
  const [otpCode, setOtpCode] = useState("");
  const [view, setView] = useState<AuthView>("main");
  const [otpPurpose, setOtpPurpose] = useState<"login" | "signup" | "reset">("login");
  const navigate = useNavigate();
  const { toast } = useToast();

  // Check if user is already logged in
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/dashboard");
      }
    };
    checkSession();
  }, [navigate]);

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const type = hashParams.get('type');
    
    if (accessToken && type === 'recovery') {
      setView("reset-password");
    }
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        // Log failed login attempt
        await logAccess({
          userEmail: email,
          eventType: 'login',
          status: 'fallido',
          details: error.message
        });
        throw error;
      }

      // Get user role for logging
      let userRole = 'user';
      if (data.user) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id);
        userRole = roles?.[0]?.role || 'user';
      }

      // Get user name
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", data.user?.id)
        .single();

      // Log successful login
      await logAccess({
        userId: data.user?.id,
        userName: profile?.full_name || data.user?.email?.split('@')[0],
        userEmail: email,
        userRole: userRole,
        eventType: 'login',
        status: 'exitoso'
      });

      toast({
        title: "¡Bienvenido!",
        description: "Has iniciado sesión correctamente."
      });
      navigate("/dashboard");
    } catch (error: any) {
      toast({
        title: "Error al iniciar sesión",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!area) {
      toast({
        title: "Área requerida",
        description: "Por favor selecciona tu área de trabajo.",
        variant: "destructive"
      });
      return;
    }
    setIsLoading(true);
    
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName
          },
          emailRedirectTo: `${window.location.origin}/dashboard`
        }
      });

      if (authError) {
        // Log failed registration
        await logAccess({
          userEmail: email,
          userName: fullName,
          eventType: 'registro',
          status: 'fallido',
          details: authError.message
        });
        throw authError;
      }

      // Update profile with area
      if (authData.user && area) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            area: area as "medicos" | "asistencial" | "administrativos"
          })
          .eq('id', authData.user.id);
        
        if (profileError) throw profileError;
      }

      // Log successful registration
      await logAccess({
        userId: authData.user?.id,
        userName: fullName,
        userEmail: email,
        userRole: 'user',
        eventType: 'registro',
        status: 'exitoso'
      });

      toast({
        title: "¡Cuenta creada!",
        description: "Tu cuenta ha sido creada exitosamente. Ya puedes iniciar sesión."
      });
    } catch (error: any) {
      toast({
        title: "Error al crear cuenta",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOTP = async (purpose: "login" | "signup") => {
    if (!email) {
      toast({
        title: "Correo requerido",
        description: "Por favor ingresa tu correo electrónico.",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoading(true);
    setOtpPurpose(purpose);
    
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: purpose === "signup",
          data: purpose === "signup" ? { full_name: fullName } : undefined
        }
      });

      if (error) throw error;

      toast({
        title: "Código enviado",
        description: `Hemos enviado un código de verificación a ${email}`
      });
      setView("otp-verify");
    } catch (error: any) {
      toast({
        title: "Error al enviar código",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: otpPurpose === "reset" ? "recovery" : "email"
      });

      if (error) {
        await logAccess({
          userEmail: email,
          eventType: otpPurpose === "signup" ? 'registro' : 'login',
          status: 'fallido',
          details: `OTP inválido: ${error.message}`
        });
        throw error;
      }

      if (otpPurpose === "reset") {
        setView("reset-password");
        toast({
          title: "Código verificado",
          description: "Ahora puedes crear tu nueva contraseña."
        });
      } else {
        if (otpPurpose === "signup" && data.user && area) {
          await supabase
            .from('profiles')
            .update({
              full_name: fullName,
              area: area as "medicos" | "asistencial" | "administrativos"
            })
            .eq('id', data.user.id);
        }

        let userRole = 'user';
        if (data.user) {
          const { data: roles } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", data.user.id);
          userRole = roles?.[0]?.role || 'user';
        }

        await logAccess({
          userId: data.user?.id,
          userName: fullName || data.user?.email?.split('@')[0],
          userEmail: email,
          userRole: userRole,
          eventType: otpPurpose === "signup" ? 'registro' : 'login',
          status: 'exitoso',
          details: 'Acceso via OTP'
        });

        toast({
          title: "¡Bienvenido!",
          description: otpPurpose === "signup" ? "Tu cuenta ha sido creada." : "Has iniciado sesión correctamente."
        });
        navigate("/dashboard");
      }
    } catch (error: any) {
      toast({
        title: "Código inválido",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({
        title: "Correo requerido",
        description: "Por favor ingresa tu correo electrónico.",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`
      });

      if (error) throw error;

      toast({
        title: "Correo enviado",
        description: "Revisa tu bandeja de entrada para restablecer tu contraseña."
      });
      setOtpPurpose("reset");
      setView("otp-verify");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "Las contraseñas no coinciden.",
        variant: "destructive"
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "La contraseña debe tener al menos 6 caracteres.",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast({
        title: "¡Contraseña actualizada!",
        description: "Tu contraseña ha sido cambiada exitosamente."
      });
      setView("main");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderBackButton = () => (
    <Button 
      variant="ghost" 
      onClick={() => { setView("main"); setOtpCode(""); }}
      className="mb-4"
    >
      <ArrowLeft className="w-4 h-4 mr-2" />
      Volver
    </Button>
  );

  const renderOTPVerify = () => (
    <Card className="bg-white/95 backdrop-blur-md border-white/20" style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
      <CardHeader>
        {renderBackButton()}
        <CardTitle>Verificar código</CardTitle>
        <CardDescription>
          Ingresa el código de 6 dígitos enviado a {email}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleVerifyOTP} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="otp">Código de verificación</Label>
            <Input 
              id="otp" 
              type="text" 
              placeholder="123456"
              value={otpCode}
              onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              className="text-center text-2xl tracking-widest"
              required 
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading || otpCode.length !== 6}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verificando...
              </>
            ) : "Verificar código"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );

  const renderForgotPassword = () => (
    <Card className="bg-white/95 backdrop-blur-md border-white/20" style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
      <CardHeader>
        {renderBackButton()}
        <CardTitle>¿Olvidaste tu contraseña?</CardTitle>
        <CardDescription>
          Ingresa tu correo y te enviaremos un enlace para restablecerla
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleForgotPassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reset-email">Correo electrónico</Label>
            <Input 
              id="reset-email" 
              type="email" 
              placeholder="tu@correo.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required 
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : "Enviar enlace de recuperación"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );

  const renderResetPassword = () => (
    <Card className="bg-white/95 backdrop-blur-md border-white/20" style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
      <CardHeader>
        <CardTitle>Nueva contraseña</CardTitle>
        <CardDescription>
          Crea una nueva contraseña para tu cuenta
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">Nueva contraseña</Label>
            <Input 
              id="new-password" 
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              minLength={6}
              required 
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar contraseña</Label>
            <Input 
              id="confirm-password" 
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              minLength={6}
              required 
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Actualizando...
              </>
            ) : "Actualizar contraseña"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Image with Blur */}
      <div 
        className="absolute inset-0 bg-cover bg-center" 
        style={{
          backgroundImage: `url(${heroImage})`,
          filter: 'blur(8px)',
          transform: 'scale(1.1)'
        }} 
      />
      
      {/* Overlay */}
      <div className="absolute inset-0 bg-primary/60" />
      
      {/* Content */}
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 bg-white/90 backdrop-blur-sm shadow-xl">
            <Power className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2 drop-shadow-lg">Novasalud Caribe IPS</h1>
          <p className="text-white/90 drop-shadow">Plataforma de Capacitación</p>
        </div>

        {view === "main" && (
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4 bg-white/90 backdrop-blur-sm">
              <TabsTrigger value="signin">Iniciar Sesión</TabsTrigger>
              <TabsTrigger value="signup">Registro</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <Card className="bg-white/95 backdrop-blur-md border-white/20" style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
                <CardHeader>
                  <CardTitle>Inicia sesión</CardTitle>
                  <CardDescription>Te enviaremos un código de verificación a tu correo</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Correo electrónico</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      placeholder="tu@correo.com" 
                      value={email} 
                      onChange={e => setEmail(e.target.value)} 
                      required 
                    />
                  </div>
                  <Button 
                    type="button" 
                    className="w-full"
                    onClick={() => handleSendOTP("login")}
                    disabled={isLoading || !email}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enviando código...
                      </>
                    ) : (
                      <>
                        <Mail className="mr-2 h-4 w-4" />
                        Enviar código de acceso
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="signup">
              <Card className="bg-white/95 backdrop-blur-md border-white/20" style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
                <CardHeader>
                  <CardTitle>Crear cuenta</CardTitle>
                  <CardDescription>Te enviaremos un código de verificación a tu correo</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullname">Nombre completo</Label>
                    <Input 
                      id="fullname" 
                      type="text" 
                      placeholder="Juan Pérez" 
                      value={fullName} 
                      onChange={e => setFullName(e.target.value)} 
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Correo electrónico</Label>
                    <Input 
                      id="signup-email" 
                      type="email" 
                      placeholder="tu@correo.com" 
                      value={email} 
                      onChange={e => setEmail(e.target.value)} 
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="area">Área de trabajo</Label>
                    <Select 
                      value={area} 
                      onValueChange={value => setArea(value as "medicos" | "asistencial" | "administrativos")} 
                      required
                    >
                      <SelectTrigger id="area">
                        <SelectValue placeholder="Selecciona tu área" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="medicos">Médicos</SelectItem>
                        <SelectItem value="asistencial">Asistencial</SelectItem>
                        <SelectItem value="administrativos">Administrativos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    type="button" 
                    className="w-full"
                    onClick={() => handleSendOTP("signup")}
                    disabled={isLoading || !email || !fullName || !area}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enviando código...
                      </>
                    ) : (
                      <>
                        <Mail className="mr-2 h-4 w-4" />
                        Enviar código de registro
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
        {view === "otp-verify" && renderOTPVerify()}
        {view === "forgot-password" && renderForgotPassword()}
        {view === "reset-password" && renderResetPassword()}
      </div>
    </div>
  );
};

export default Auth;
