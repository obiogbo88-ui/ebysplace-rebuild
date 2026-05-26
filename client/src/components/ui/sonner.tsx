import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      style={
        {
          "--normal-bg": "#111111",
          "--normal-text": "#f8f4eb",
          "--normal-border": "#c9a84c",
          "--success-bg": "#14532d",
          "--success-text": "#f0fdf4",
          "--success-border": "#86efac",
          "--error-bg": "#7f1d1d",
          "--error-text": "#fef2f2",
          "--error-border": "#fca5a5",
          "--warning-bg": "#facc15",
          "--warning-text": "#1f2937",
          "--warning-border": "#ca8a04",
          "--info-bg": "#1d4ed8",
          "--info-text": "#eff6ff",
          "--info-border": "#93c5fd",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
