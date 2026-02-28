import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

export const usePWAInstall = () => {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isInstallable, setIsInstallable] = useState(false);

    useEffect(() => {
        const updateState = (e) => {
            setDeferredPrompt(e);
            setIsInstallable(true);
        };

        // If the event fired before this component mounted
        if (window.deferredPWAEvent) {
            updateState(window.deferredPWAEvent);
        }

        const handleBeforeInstall = (e) => {
            e.preventDefault();
            updateState(e);
        };

        const handleCustomEvent = () => {
            if (window.deferredPWAEvent) {
                updateState(window.deferredPWAEvent);
            }
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstall);
        window.addEventListener('pwa-installable', handleCustomEvent);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
            window.removeEventListener('pwa-installable', handleCustomEvent);
        };
    }, []);

    const install = async () => {
        const promptEvent = window.deferredPWAEvent || deferredPrompt;

        if (!promptEvent) {
            toast.error("La instalación nativa no está lista. Intenta instalar desde el ícono en la barra de direcciones de Chrome.", { duration: 6000 });
            return;
        }

        try {
            // Show the install prompt
            promptEvent.prompt();

            // Wait for the user to respond to the prompt
            const { outcome } = await promptEvent.userChoice;

            if (outcome === 'accepted') {
                console.log('User accepted the install prompt');
                toast.success("¡Instalando! Busca el icono en tu Escritorio o Inicio", { duration: 5000, icon: '🚀' });
            } else {
                console.log('User dismissed the install prompt');
            }

            // We've used the prompt, and can't use it again, discard it
            window.deferredPWAEvent = null;
            setDeferredPrompt(null);
            setIsInstallable(false);
        } catch (error) {
            console.error("Error showing install prompt:", error);
            toast.error("Error al mostrar el instalador. Intenta desde el navegador.");
        }
    };

    return { isInstallable, install };
};
