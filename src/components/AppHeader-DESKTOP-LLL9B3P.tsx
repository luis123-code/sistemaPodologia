import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, ChevronDown, LogOut, User, MessageCircle, Send, Code2 } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { initialsFromName, loadUserProfile, saveUserProfile, type StoredUserProfile } from "@/lib/userProfileStorage";

export function AppHeader() {
  const [searchValue, setSearchValue] = useState("");
  const [consultOpen, setConsultOpen] = useState(false);
  const [consultaTexto, setConsultaTexto] = useState("");
  const [profile, setProfile] = useState<StoredUserProfile>(() => loadUserProfile());
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileDraft, setProfileDraft] = useState<StoredUserProfile>(() => loadUserProfile());
  const [logoutOpen, setLogoutOpen] = useState(false);

  const openProfileDialog = () => {
    setProfileDraft(loadUserProfile());
    setProfileOpen(true);
  };

  const guardarPerfil = () => {
    const next = {
      displayName: profileDraft.displayName.trim() || "Usuario",
      email: profileDraft.email.trim(),
      role: profileDraft.role.trim(),
    };
    saveUserProfile(next);
    setProfile(next);
    setProfileOpen(false);
    toast.success("Perfil actualizado");
  };

  const confirmarCerrarSesion = () => {
    setLogoutOpen(false);
    
    localStorage.removeItem("token");
    
    window.location.href = "https://anh-billowier-atlas.ngrok-free.dev/?token=true";
  };

  const enviarConsulta = () => {
    const texto = consultaTexto.trim();
    if (!texto) {
      toast.error("Escribe tu consulta o mensaje");
      return;
    }
    toast.success("Mensaje enviado (demo local)", {
      description:
        "Esta versión no envía datos a un servidor. En despliegue real, tu consulta llegaría al programador o soporte.",
    });
    setConsultaTexto("");
    setConsultOpen(false);
  };

  return (
    <header className="flex h-14 min-h-14 shrink-0 items-center justify-between gap-2 border-b border-primary/10 bg-card/95 bg-gradient-to-r from-primary/[0.04] via-card to-card px-3 backdrop-blur-sm sm:h-16 sm:min-h-16 sm:gap-3 sm:px-4 lg:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <SidebarTrigger className="shrink-0 text-muted-foreground hover:text-foreground" />
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <Popover open={consultOpen} onOpenChange={setConsultOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className={cn(
                "h-9 min-w-[2.85rem] px-2 gap-0.5 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors",
                consultOpen && "bg-primary/10 text-primary",
              )}
              title="Mensaje al programador — escribe tu consulta técnica"
              aria-expanded={consultOpen}
              aria-label="Abrir mensaje al programador: consulta o soporte"
            >
              <MessageCircle className="h-[18px] w-[18px] shrink-0" aria-hidden />
              <Code2 className="h-[15px] w-[15px] shrink-0 opacity-90" aria-hidden />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            side="bottom"
            sideOffset={10}
            collisionPadding={16}
            className="w-[min(calc(100vw-1.5rem),22rem)] sm:w-[26rem] p-0 rounded-xl border border-primary/15 shadow-xl shadow-primary/5 overflow-hidden data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <div className="bg-gradient-to-br from-primary/[0.12] via-card to-card border-b border-primary/10 px-4 py-3.5">
              <div className="flex gap-3">
                <div
                  className="flex h-11 min-w-[3.25rem] shrink-0 items-center justify-center gap-0.5 rounded-xl bg-primary/15 px-2 ring-1 ring-primary/20"
                  aria-hidden
                >
                  <MessageCircle className="h-4 w-4 text-primary" />
                  <Code2 className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="min-w-0 pt-0.5">
                  <h3 className="text-sm font-semibold text-foreground leading-tight">Mensaje al programador</h3>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                    Icono de chat + código: tu consulta va dirigida al equipo de desarrollo. Demo local: el texto no sale del
                    navegador.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 space-y-3 bg-card">
              <div className="space-y-2">
                <Label htmlFor="consulta-usuario" className="text-xs font-medium text-muted-foreground">
                  Tu mensaje
                </Label>
                <Textarea
                  id="consulta-usuario"
                  placeholder="Describe tu consulta con el detalle que necesites…"
                  className="min-h-[132px] resize-y rounded-lg border border-border/80 bg-muted/30 text-sm shadow-inner focus-visible:ring-2 focus-visible:ring-primary/25"
                  value={consultaTexto}
                  onChange={(e) => setConsultaTexto(e.target.value)}
                  maxLength={4000}
                />
                <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                  <span>Máx. 4000 caracteres</span>
                  <span className="tabular-nums">{consultaTexto.length}/4000</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 p-3 sm:p-4 pt-0 bg-muted/25 border-t border-border/60">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 border-border/80"
                onClick={() => setConsultOpen(false)}
              >
                Cerrar
              </Button>
              <Button type="button" size="sm" className="flex-1 gap-1.5" onClick={enviarConsulta}>
                <Send className="h-3.5 w-3.5" />
                Enviar
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex max-w-[11rem] items-center gap-1.5 rounded-lg pl-1.5 pr-2 sm:gap-2 sm:pl-2 sm:pr-3 data-[state=open]:bg-primary/10 data-[state=open]:text-primary"
              aria-haspopup="menu"
              aria-label="Menú de cuenta de usuario"
            >
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {initialsFromName(profile.displayName)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden min-w-0 truncate md:inline text-sm font-medium">{profile.displayName}</span>
              <ChevronDown className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground sm:inline" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className="w-56 rounded-xl border border-border/60 p-1.5 shadow-lg"
          >
            <DropdownMenuItem
              className="cursor-pointer rounded-lg gap-2 data-[highlighted]:bg-primary/10 data-[highlighted]:text-primary"
              onSelect={() => {
                openProfileDialog();
              }}
            >
              <User className="h-4 w-4 shrink-0" />
              Mi perfil
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-1.5" />
            <DropdownMenuItem
              className="cursor-pointer rounded-lg gap-2 text-destructive focus:text-destructive data-[highlighted]:bg-destructive/10"
              onSelect={() => {
                setTimeout(() => setLogoutOpen(true), 0);
              }}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Mi perfil</DialogTitle>
              <DialogDescription>
                Datos visibles en la cabecera. Se guardan solo en este navegador (demo).
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 px-1 py-2">
              <div className="grid gap-2">
                <Label htmlFor="profile-name">Nombre mostrado</Label>
                <Input
                  id="profile-name"
                  value={profileDraft.displayName}
                  onChange={(e) => setProfileDraft((d) => ({ ...d, displayName: e.target.value }))}
                  autoComplete="name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="profile-email">Correo</Label>
                <Input
                  id="profile-email"
                  type="email"
                  value={profileDraft.email}
                  onChange={(e) => setProfileDraft((d) => ({ ...d, email: e.target.value }))}
                  autoComplete="email"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="profile-role">Rol o especialidad</Label>
                <Input
                  id="profile-role"
                  value={profileDraft.role}
                  onChange={(e) => setProfileDraft((d) => ({ ...d, role: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setProfileOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={guardarPerfil}>
                Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Cerrar sesión?</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Estás seguro de que deseas cerrar sesión? Deberás volver a iniciar sesión para acceder.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Volver</AlertDialogCancel>
              <AlertDialogAction onClick={confirmarCerrarSesion}>Cerrar sesión</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </header>
  );
}
