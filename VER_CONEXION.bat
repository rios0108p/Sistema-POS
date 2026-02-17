@echo off
cls
echo ===================================================
echo         TU DIRECCION PARA EL CLIENTE
echo ===================================================
echo.
echo Conectate primero al WI-FI del cliente.
echo Tu cliente tambien debe estar en el mismo WI-FI.
echo.
echo DALE ESTE ENLACE A TU CLIENTE:
echo ---------------------------------------------------
ipconfig | findstr "IPv4"
echo ---------------------------------------------------
echo (Usa el numero que te salga arriba. Ejemplo: 192.168.1.50)
echo.
echo El enlace completo sera: http://[NUMERO]:3001
echo.
echo Ejemplo: http://192.168.0.15:3001
echo.
pause
