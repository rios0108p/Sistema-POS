import { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext();

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return context;
};

export const ThemeProvider = ({ children }) => {
    const getInitialTheme = () => {
        if (typeof window === 'undefined') return 'light';

        const savedTheme = localStorage.getItem("theme");
        if (savedTheme) return savedTheme;

        if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
            return "dark";
        }
        return "light";
    };

    const [theme, setTheme] = useState(getInitialTheme);

    useEffect(() => {
        const root = document.documentElement;
        const body = document.body;

        // Apply theme via multiple methods for cross-browser compatibility
        if (theme === "dark") {
            // Method 1: Class on html element
            root.classList.add("dark");
            root.classList.remove("light");

            // Method 2: Data attribute (fallback for some browsers)
            root.setAttribute("data-theme", "dark");

            // Method 3: Class on body (extra fallback)
            body.classList.add("dark");
            body.classList.remove("light");

            // Method 4: Set color-scheme meta
            root.style.colorScheme = "dark";
        } else {
            root.classList.remove("dark");
            root.classList.add("light");
            root.setAttribute("data-theme", "light");
            body.classList.remove("dark");
            body.classList.add("light");
            root.style.colorScheme = "light";
        }

        localStorage.setItem("theme", theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme((prev) => (prev === "light" ? "dark" : "light"));
    };

    const isDark = theme === "dark";

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, isDark }}>
            {children}
        </ThemeContext.Provider>
    );
};

export default ThemeContext;
