import { useRef, useEffect } from "react";
import { Search, Loader2, User } from "lucide-react";
import { Input } from "@/components/ui/input";

interface PatientSearchDropdownProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (patient: any) => void;
  results: any[];
  loading: boolean;
  showDropdown: boolean;
  setShowDropdown: (show: boolean) => void;
  placeholder?: string;
  inputStyle?: React.CSSProperties;
  loadOnFocus?: () => void;
}

export function PatientSearchDropdown({
  value,
  onChange,
  onSelect,
  results,
  loading,
  showDropdown,
  setShowDropdown,
  placeholder = "Buscar paciente...",
  inputStyle,
  loadOnFocus,
}: PatientSearchDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [setShowDropdown]);

  const handleFocus = () => {
    setShowDropdown(true);
    loadOnFocus?.();
  };

  return (
    <div className="space-y-2 relative" ref={dropdownRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          placeholder={placeholder}
          className="w-full text-sm pl-9 pr-9"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={handleFocus}
          style={{
            backgroundColor: "#f5fffe",
            border: "none",
            borderRadius: "8px",
            boxShadow: "none",
            ...inputStyle,
          }}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
        )}
      </div>
      {showDropdown && results.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {results.map((patient) => {
            const nombreCompleto =
              patient.fields?.nombreCompleto ||
              `${patient.fields?.nombre || ""} ${patient.fields?.apellido || ""}`.trim() ||
              "Sin nombre";
            return (
              <div
                key={patient.id}
                className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                onClick={() => {
                  onSelect(patient);
                  setShowDropdown(false);
                }}
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e6f7f6]">
                  <User className="h-3.5 w-3.5" style={{ color: "#22b4ad" }} />
                </div>
                <div>
                  <div className="font-medium">{nombreCompleto}</div>
                  <div className="text-xs text-gray-500">{patient.fields?.telefono || ""}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
