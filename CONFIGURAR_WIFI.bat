@echo off
echo ===================================================
echo   CONFIGURANDO ACCESO PARA WI-FI (PUERTO 3001)
echo ===================================================
echo.
echo ESTE ARCHIVO NECESITA PERMISO DE ADMINISTRADOR.
echo Si ves un error abajo, cierra y dale Click Derecho - Ejecutar como Administrador.
echo.
netsh advfirewall firewall add rule name="Permitir Sistema Ventas" dir=in action=allow protocol=TCP localport=3001 profile=any
echo.
echo ===================================================
echo                 LISTO
echo ===================================================
pause
