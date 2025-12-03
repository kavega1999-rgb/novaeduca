import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import heroImage from "@/assets/team-celebration.jpg";

export const WelcomeHero = () => {
  const [userName, setUserName] = useState("");
  const [greeting, setGreeting] = useState("Bienvenido");

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();
        
        if (profile) {
          // Get first name only
          const firstName = profile.full_name.split(" ")[0];
          setUserName(firstName);
        }
      }
    };

    // Set greeting based on time of day
    const hour = new Date().getHours();
    if (hour < 12) {
      setGreeting("Buenos días");
    } else if (hour < 18) {
      setGreeting("Buenas tardes");
    } else {
      setGreeting("Buenas noches");
    }

    fetchUser();
  }, []);

  return (
    <div className="relative rounded-2xl overflow-hidden h-[280px] md:h-[320px]" style={{ boxShadow: "var(--shadow-lg)" }}>
      <img 
        src={heroImage} 
        alt="Equipo médico Novasalud" 
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/80 to-transparent" />
      <div className="absolute inset-0 flex items-center">
        <div className="px-8 md:px-12 max-w-2xl">
          <p className="text-white/80 text-lg mb-2">{greeting},</p>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
            {userName || "Usuario"}
          </h1>
          <p className="text-white/90 text-base md:text-lg max-w-lg">
            Continúa desarrollando tus habilidades con nuestras capacitaciones profesionales
          </p>
        </div>
      </div>
      
      {/* Decorative elements */}
      <div className="absolute bottom-0 right-0 w-64 h-64 bg-white/5 rounded-tl-full" />
      <div className="absolute top-0 right-20 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
    </div>
  );
};
