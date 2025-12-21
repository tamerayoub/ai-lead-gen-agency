import { createContext, useContext, useEffect, useState, useLayoutEffect } from "react";

type Theme = "dark" | "light";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  forcedTheme?: Theme;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(
  undefined
);

export function ThemeProvider({
  children,
  defaultTheme = "dark",
  forcedTheme,
}: ThemeProviderProps) {
  // When forcedTheme is set, ignore localStorage completely
  const [theme, setThemeState] = useState<Theme>(
    () => forcedTheme ? forcedTheme : (localStorage.getItem("theme") as Theme) || defaultTheme
  );

  // Use layoutEffect to apply theme before paint (prevents flash)
  useLayoutEffect(() => {
    const root = document.documentElement;
    
    // Capture the current theme before we change it (for cleanup)
    const previousTheme = root.classList.contains("dark") ? "dark" : "light";
    
    root.classList.remove("light", "dark");
    
    // If forcedTheme is set, always use it and ignore state/localStorage
    const activeTheme = forcedTheme || theme;
    root.classList.add(activeTheme);
    
    // Cleanup: when component unmounts, restore the previous theme if we were forcing one
    return () => {
      if (forcedTheme) {
        root.classList.remove("light", "dark");
        // Restore from localStorage or default
        const storedTheme = (localStorage.getItem("theme") as Theme) || defaultTheme;
        root.classList.add(storedTheme);
      }
    };
  }, [theme, forcedTheme, defaultTheme]);

  // Sync to localStorage only when not forcing theme
  useEffect(() => {
    if (!forcedTheme) {
      localStorage.setItem("theme", theme);
    }
  }, [theme, forcedTheme]);

  // When forcedTheme is set, make setTheme a no-op
  const setTheme = (newTheme: Theme) => {
    if (!forcedTheme) {
      setThemeState(newTheme);
    }
    // If forcedTheme is set, ignore the call
  };

  return (
    <ThemeProviderContext.Provider value={{ theme: forcedTheme || theme, setTheme }}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);
  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");
  return context;
};
