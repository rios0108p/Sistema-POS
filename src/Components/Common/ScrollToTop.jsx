import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const ScrollToTop = () => {
    const { pathname } = useLocation();

    useEffect(() => {
        window.scrollTo(0, 0);
        // También intentar hacer scroll al contenedor principal si existe un div con scroll
        const mainContainer = document.querySelector('main');
        if (mainContainer) mainContainer.scrollTo(0, 0);

        // El main de StoreLayout tiene overflow-y-auto
        // const storeMain = document.querySelector('.overflow-y-auto');
        // if (storeMain) storeMain.scrollTo(0, 0);
    }, [pathname]);

    return null;
};

export default ScrollToTop;
