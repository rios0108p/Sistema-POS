import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

export const usePWAInstall = () => {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isInstallable, setIsInstallable] = useState(false);

    useEffect(() => {
        const handler = (e) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setDeferredPrompt(e);
            setIsInstallable(true);
        };

        window.addEventListener('beforeinstallprompt', handler);

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const install = async () => {
        if (!deferredPrompt) return;

        // Show the install prompt
        deferredPrompt.prompt();

        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            console.log('User accepted the install prompt');
            toast.success("¡Instalando! Busca el icono en tu Escritorio o Inicio", { duration: 5000, icon: '🚀' });
        } else {
            console.log('User dismissed the install prompt');
        }

        // We've used the prompt, and can't use it again, discard it
        setDeferredPrompt(null);
        setIsInstallable(false);
    };

    return { isInstallable, install };
};
