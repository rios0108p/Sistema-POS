/**
 * Utility to check if the app is running in an Electron desktop environment
 */
export const isDesktop = () => {
    return !!window.electronAPI?.isDesktop;
};

/**
 * Access to native desktop APIs exposed via preload script
 */
export const desktopAPI = window.electronAPI;
