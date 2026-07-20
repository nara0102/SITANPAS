import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Fish, User, Menu, LogOut, LayoutDashboard, Settings } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useWebsiteSettings } from "@/hooks/useWebsiteSettings";
import { useRole } from "@/hooks/useRole";
import { useAdminRole } from "@/hooks/useAdminRole";
import { NotificationBell } from "@/components/ui/notification-bell";

export const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, signOut, loading } = useAuth();
  const { userRole } = useRole();
  const { isAdmin } = useAdminRole();
  const navigate = useNavigate();
  const { siteName, siteDescription, siteLogo, loading: settingsLoading } = useWebsiteSettings();
  const isFisherman = userRole === "nelayan";

  const handleAuthClick = async () => {
    if (user) {
      try {
        await signOut();
        // Redirect to marketplace after successful logout
        navigate("/", { replace: true });
      } catch (error) {
        console.error("Logout error:", error);
      }
    } else {
      navigate("/auth");
    }
    setIsOpen(false);
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto px-3 sm:px-4">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Logo - Make it clickable to go to marketplace */}
          <div className="flex items-center space-x-1 sm:space-x-2 cursor-pointer" onClick={() => navigate("/")}>
            <div className="bg-primary rounded-lg p-1.5 sm:p-2">
              {!settingsLoading && siteLogo && siteLogo !== "/favicon.ico" ? (
                <img src={siteLogo} alt="Logo" className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 object-contain" />
              ) : (
                <Fish className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white" />
              )}
            </div>
            <div>
              <h1 className="font-bold text-base sm:text-lg md:text-xl text-primary">{settingsLoading ? "" : siteName}</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">{settingsLoading ? "" : siteDescription}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            {/* Notification Bell - Show only for fisherman */}
            {user && isFisherman && <NotificationBell />}

            {/* Dashboard Button - Show only when logged in as fisherman */}
            {user && isFisherman && (
              <Button variant="default" size="sm" className="hidden sm:flex text-xs lg:text-sm" onClick={() => navigate("/dashboard")}>
                <LayoutDashboard className="w-3 h-3 lg:w-4 lg:h-4 mr-1 lg:mr-2" />
                Dashboard
              </Button>
            )}

            {/* Admin Dashboard Button - Show only when logged in as admin */}
            {user && isAdmin && (
              <Button variant="secondary" size="sm" className="hidden sm:flex text-xs lg:text-sm" onClick={() => navigate("/admin")}>
                <Settings className="w-3 h-3 lg:w-4 lg:h-4 mr-1 lg:mr-2" />
                Admin
              </Button>
            )}

            {/* Desktop Auth Button */}
            <Button variant="outline" size="sm" className="hidden lg:flex text-xs lg:text-sm" onClick={handleAuthClick} disabled={loading}>
              {user ? (
                <>
                  <LogOut className="w-3 h-3 lg:w-4 lg:h-4 mr-1 lg:mr-2" />
                  Keluar
                </>
              ) : (
                <>
                  <User className="w-3 h-3 lg:w-4 lg:h-4 mr-1 lg:mr-2" />
                  Login / Daftar
                </>
              )}
            </Button>

            {/* Mobile Auth Button */}
            <Button variant="outline" size="sm" className="hidden sm:flex lg:hidden p-2" onClick={handleAuthClick} disabled={loading}>
              {user ? <LogOut className="w-3 h-3 sm:w-4 sm:h-4" /> : <User className="w-3 h-3 sm:w-4 sm:h-4" />}
            </Button>

            {/* Mobile Menu */}
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden p-1.5">
                  <Menu className="w-4 h-4 sm:w-5 sm:h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64">
                <div className="flex flex-col space-y-6 mt-6">
                  {user && isFisherman && (
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={() => {
                        navigate("/dashboard");
                        setIsOpen(false);
                      }}
                    >
                      <LayoutDashboard className="w-4 h-4 mr-2" />
                      Dashboard
                    </Button>
                  )}

                  {user && isAdmin && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        navigate("/admin");
                        setIsOpen(false);
                      }}
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Dashboard Admin
                    </Button>
                  )}
                  <div className="border-t pt-4">
                    <Button variant="outline" className="w-full" onClick={handleAuthClick} disabled={loading}>
                      {user ? (
                        <>
                          <LogOut className="w-4 h-4 mr-2" />
                          Keluar
                        </>
                      ) : (
                        <>
                          <User className="w-4 h-4 mr-2" />
                          Login / Daftar
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
};
