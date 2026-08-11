import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Fish, Anchor, Waves, User, Mail, Lock, Eye, EyeOff, Ship, MapPin, Phone, ShoppingBag } from "lucide-react";
import { useWebsiteSettings } from "@/hooks/useWebsiteSettings";
import { useToast } from "@/hooks/use-toast";

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [activeTab, setActiveTab] = useState("signin");

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    phone: "",
    location: "",
  });

  const { signIn, signUp, user, loading } = useAuth();
  const { siteName, siteDescription, siteLogo, loading: settingsLoading } = useWebsiteSettings();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Redirect based on role and approval status
  useEffect(() => {
    const checkUserRoleAndRedirect = async () => {
      // Don't redirect if auth is still loading
      if (loading) {
        return;
      }

      if (user) {
        try {
          // Check user role using get_user_role function
          const { data: userRole, error: roleError } = await supabase.rpc('get_user_role', {
            _user_id: user.id
          });

          // If role check succeeds and user is admin, redirect to admin dashboard
          if (!roleError && userRole === 'admin') {
            navigate("/admin", { replace: true });
            return;
          }

          // For all users, check their status in users table
          const { data: userData, error: userError } = await supabase.from("users").select("role, status").eq("id", user.id).maybeSingle();

          if (userError) {
            console.error("Error fetching user role:", userError);
            // If user not found in users table, stay on auth page
            return;
          }

          // If user doesn't exist in users table, create a basic profile
          if (!userData) {
            console.log("User not found in users table, creating basic profile...");
            const { error: insertError } = await supabase.from("users").insert({
              id: user.id,
              email: user.email,
              role: "customer_guest",
              status: "active",
              full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
              phone: user.user_metadata?.phone || null,
              address: user.user_metadata?.location || null
            });

            if (insertError) {
              console.error("Error creating user profile:", insertError);
              return;
            }

            // Redirect to marketplace for new customer_guest users
            navigate("/", { replace: true });
            return;
          }

          // Check user status first - don't redirect if pending approval
          if (userData?.status === "pending") {
            // User is pending approval, stay on auth page
            // The signIn function in AuthContext will handle the logout and show message
            return;
          }

          if (userData?.status === "inactive") {
            // User is inactive, stay on auth page
            return;
          }

          // Only redirect if user has active status
          if (userData?.status === "active") {
            // If user has 'admin' role, redirect to admin dashboard
            if (userData?.role === "admin") {
              navigate("/admin", { replace: true });
              return;
            }

            // If user has 'nelayan' role, redirect to nelayan dashboard
            if (userData?.role === "nelayan") {
              navigate("/dashboard", { replace: true });
              return;
            }

            // For customer_guest or other roles, redirect to marketplace
            navigate("/", { replace: true });
          }
        } catch (error) {
          console.error("Error in role check:", error);
          // Don't redirect on error, stay on auth page
        }
      }
    };

    // Only run redirect logic if not loading
    if (!loading) {
      checkUserRoleAndRedirect();
    }
  }, [user, navigate, loading]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleUserTypeChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      userType: value as "fisherman" | "buyer",
    }));
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validate sign in data using zod schema
      const { signInSchema } = await import('@/lib/validation');
      
      const validationData = {
        email: formData.email,
        password: formData.password,
      };

      const validation = signInSchema.safeParse(validationData);
      
      if (!validation.success) {
        const firstError = validation.error.issues[0];
        toast({
          title: "Kesalahan Validasi",
          description: firstError.message,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      await signIn(formData.email, formData.password);
    } catch (error) {
      console.error('Sign in error:', error);
      toast({
        title: "Kesalahan",
        description: "Terjadi kesalahan saat login. Silakan coba lagi.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validate sign up data using zod schema
      const { signUpSchema } = await import('@/lib/validation');
      
      const validationData = {
        email: formData.email,
        password: formData.password,
        fullName: formData.fullName,
        phone: formData.phone,
        location: formData.location,
      };

      const validation = signUpSchema.safeParse(validationData);
      
      if (!validation.success) {
        const firstError = validation.error.issues[0];
        toast({
          title: "Kesalahan Validasi",
          description: firstError.message,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const userMetadata = {
        full_name: formData.fullName,
        phone: formData.phone,
        location: formData.location,
        user_type: "fisherman", // All new registrations are fishermen who need approval
      };

      const result = await signUp(formData.email, formData.password, userMetadata);

      if (!result.error) {
        // Registration successful - user will be pending approval
        // Reset form data
        setFormData({
          email: "",
          password: "",
          fullName: "",
          phone: "",
          location: "",
        });
        
        // Don't force redirect - let the useEffect handle role-based redirect
        // The useEffect will check user role and redirect appropriately
      }
    } catch (error) {
      console.error('Sign up error:', error);
      toast({
        title: "Kesalahan",
        description: "Terjadi kesalahan saat mendaftar. Silakan coba lagi.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50 relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Floating Fish Icons */}
        <div className="absolute top-20 left-10 animate-bounce">
          <Fish className="w-8 h-8 text-blue-300/40" />
        </div>
        <div className="absolute top-40 right-20 animate-pulse">
          <Anchor className="w-6 h-6 text-cyan-300/40" />
        </div>
        <div className="absolute bottom-40 left-20 animate-bounce delay-1000">
          <Waves className="w-10 h-10 text-teal-300/40" />
        </div>
        <div className="absolute bottom-20 right-10 animate-pulse delay-500">
          <Ship className="w-8 h-8 text-blue-300/40" />
        </div>

        {/* Gradient Circles */}
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-200/20 to-cyan-200/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-teal-200/20 to-cyan-200/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md lg:max-w-lg xl:max-w-xl">
          {/* Header Section */}
          <div className="text-center mb-8 lg:mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 lg:w-20 lg:h-20 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl mb-4 lg:mb-6 shadow-lg">
              {settingsLoading ? (
                <div className="w-8 h-8 lg:w-10 lg:h-10 bg-white/20 rounded animate-pulse"></div>
              ) : siteLogo ? (
                <img src={siteLogo} alt={siteName} className="w-8 h-8 lg:w-10 lg:h-10 object-contain" />
              ) : (
                <Fish className="w-8 h-8 lg:w-10 lg:h-10 text-white" />
              )}
            </div>
            {settingsLoading ? (
              <>
                <div className="h-8 lg:h-10 xl:h-12 bg-gray-200 rounded-lg animate-pulse mb-2 mx-auto max-w-xs"></div>
                <div className="h-4 lg:h-5 bg-gray-200 rounded animate-pulse mx-auto max-w-sm"></div>
              </>
            ) : (
              <>
                <h1 className="text-2xl lg:text-3xl xl:text-4xl font-bold bg-gradient-to-r from-blue-900 via-cyan-800 to-teal-800 bg-clip-text text-transparent mb-2">{siteName}</h1>
                <p className="text-sm lg:text-base text-gray-600 max-w-sm mx-auto">{siteDescription}</p>
              </>
            )}
          </div>

          {/* Auth Card */}
          <Card className="backdrop-blur-sm bg-white/80 border-0 shadow-2xl animate-in slide-in-from-bottom-4 duration-500">
            <CardContent className="p-6 lg:p-8">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 h-12 lg:h-14 bg-gray-100/50 p-1 rounded-xl">
                  <TabsTrigger value="signin" className="text-sm lg:text-base font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-700 rounded-lg transition-all duration-300 ease-in-out">
                    <User className="w-4 h-4 lg:w-5 lg:h-5 mr-2" />
                    Masuk
                  </TabsTrigger>
                  <TabsTrigger value="signup" className="text-sm lg:text-base font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-700 rounded-lg transition-all duration-300 ease-in-out">
                    <Anchor className="w-4 h-4 lg:w-5 lg:h-5 mr-2" />
                    Daftar
                  </TabsTrigger>
                </TabsList>

                {/* Sign In Tab */}
                <TabsContent value="signin" className="mt-6 lg:mt-8 animate-in fade-in-0 slide-in-from-left-2 duration-300">
                  <form onSubmit={handleSignIn} className="space-y-4 lg:space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="signin-email" className="text-sm lg:text-base font-medium text-gray-700 flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        Email
                      </Label>
                      <Input
                        id="signin-email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="nelayan@example.com"
                        className="h-11 lg:h-12 text-sm lg:text-base border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-300"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signin-password" className="text-sm lg:text-base font-medium text-gray-700 flex items-center gap-2">
                        <Lock className="w-4 h-4" />
                        Password
                      </Label>
                      <div className="relative">
                        <Input
                          id="signin-password"
                          name="password"
                          type={showPassword ? "text" : "password"}
                          value={formData.password}
                          onChange={handleInputChange}
                          placeholder="Masukkan password"
                          className="h-11 lg:h-12 text-sm lg:text-base border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-300 pr-12"
                          required
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors duration-200 hover:scale-110">
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-11 lg:h-12 text-sm lg:text-base font-medium bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out transform hover:-translate-y-1 hover:scale-[1.02] active:scale-[0.98]"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          Memproses...
                        </div>
                      ) : (
                        "Masuk ke Akun"
                      )}
                    </Button>
                  </form>
                </TabsContent>

                {/* Sign Up Tab */}
                <TabsContent value="signup" className="mt-6 lg:mt-8 animate-in fade-in-0 slide-in-from-right-2 duration-300">
                  <div className="text-center mb-6 lg:mb-8">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full mb-3 animate-pulse">
                      <Ship className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg lg:text-xl font-semibold text-gray-800 mb-1">Daftar sebagai Nelayan</h3>
                    <p className="text-sm text-gray-600">Bergabunglah dengan komunitas nelayan terpercaya</p>
                  </div>

                  <form onSubmit={handleSignUp} className="space-y-4 lg:space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name" className="text-sm lg:text-base font-medium text-gray-700 flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Nama Lengkap
                      </Label>
                      <Input
                        id="signup-name"
                        name="fullName"
                        type="text"
                        value={formData.fullName}
                        onChange={handleInputChange}
                        placeholder="Masukkan nama lengkap"
                        className="h-11 lg:h-12 text-sm lg:text-base border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-300"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-email" className="text-sm lg:text-base font-medium text-gray-700 flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        Email
                      </Label>
                      <Input
                        id="signup-email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="name@nelayan.com"
                        className="h-11 lg:h-12 text-sm lg:text-base border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-300"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-phone" className="text-sm lg:text-base font-medium text-gray-700 flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        Nomor Telepon
                      </Label>
                      <Input
                        id="signup-phone"
                        name="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={handleInputChange}
                        placeholder="08xxxxxxxxxx"
                        className="h-11 lg:h-12 text-sm lg:text-base border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-300"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-location" className="text-sm lg:text-base font-medium text-gray-700 flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Lokasi Nelayan
                      </Label>
                      <Input
                        id="signup-location"
                        name="location"
                        type="text"
                        value={formData.location}
                        onChange={handleInputChange}
                        placeholder="Contoh: Ambesia Selatan, Parigi Moutong"
                        className="h-11 lg:h-12 text-sm lg:text-base border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-300"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-password" className="text-sm lg:text-base font-medium text-gray-700 flex items-center gap-2">
                        <Lock className="w-4 h-4" />
                        Password
                      </Label>
                      <div className="relative">
                        <Input
                          id="signup-password"
                          name="password"
                          type={showSignupPassword ? "text" : "password"}
                          value={formData.password}
                          onChange={handleInputChange}
                          placeholder="Minimal 6 karakter"
                          className="h-11 lg:h-12 text-sm lg:text-base border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-300 pr-12"
                          required
                        />
                        <button type="button" onClick={() => setShowSignupPassword(!showSignupPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors duration-200 hover:scale-110">
                          {showSignupPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Password minimal 6 karakter untuk keamanan akun</p>
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-11 lg:h-12 text-sm lg:text-base font-medium bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out transform hover:-translate-y-1 hover:scale-[1.02] active:scale-[0.98]"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          Memproses...
                        </div>
                      ) : (
                        "Daftar sebagai Nelayan"
                      )}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>

              {/* Marketplace Shortcut Button */}
              <div className="mt-6 lg:mt-8 pt-6 lg:pt-8 border-t border-gray-200/50">
                <div className="text-center">
                  <p className="text-xs lg:text-sm text-gray-500 mb-3 lg:mb-4">
                    Atau jelajahi produk tanpa login
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/")}
                    className="w-full h-10 lg:h-11 text-sm lg:text-base font-medium border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-300 ease-in-out transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <ShoppingBag className="w-4 h-4 lg:w-5 lg:h-5 mr-2" />
                    Lihat Marketplace
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Auth;
