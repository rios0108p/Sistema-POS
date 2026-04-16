<?php
define('BASE_URL', '#');
// require_once __DIR__ . '/config/config.php';
// If user is already logged in, redirect to their dashboard
/* Session check disabled for preview */

/* Mocked Stats */
$countTrainers = 15;
$countAthletes = 342;
$countDisciplines = 12;
$countSpaces = 6;
        
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SRE - Sistema de Registro de Entrenadores | Bacalar</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800&display=swap" rel="stylesheet">
    <style>
        :root {
            --qroo-maroon: #60021c;
            --qroo-maroon-dark: #450114;
            --qroo-gold: #c69435;
            --qroo-slate: #232222;
        }
        body { font-family: 'Outfit', sans-serif; background-color: #f8fafc; }
        .bg-institutional {
            background: radial-gradient(circle at top right, rgba(96, 2, 28, 0.05), transparent 40%),
                        radial-gradient(circle at bottom left, rgba(198, 148, 53, 0.05), transparent 40%),
                        #f8fafc;
        }
        .glass-card {
            background: rgba(255, 255, 255, 0.7);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.4);
        }
    </style>
</head>
<body class="bg-institutional min-h-screen flex flex-col">

    <!-- Premium Navigation -->
    <nav class="px-8 lg:px-20 py-8 flex justify-between items-center z-20">
        <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--qroo-maroon)] to-[var(--qroo-maroon-dark)] flex items-center justify-center text-white font-serif italic text-2xl font-bold shadow-2xl border border-white/10">B</div>
            <div>
                <div class="text-xl font-black tracking-tight text-[var(--qroo-slate)] leading-none">BACALAR</div>
                <div class="text-[10px] text-gray-400 uppercase tracking-widest mt-1 font-bold">Dirección de Deportes</div>
            </div>
        </div>
        <div class="hidden md:flex items-center gap-10">
            <!-- Navigation cleaned for professional look -->
        </div>
    </nav>

    <!-- Main Hero Section -->
    <main class="flex-1 flex items-center justify-center p-6 relative overflow-hidden">
        <!-- Abstract Background Shapes -->
        <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[var(--qroo-maroon)]/5 rounded-full blur-[120px] -z-10 animate-pulse"></div>
        
        <div class="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <div class="space-y-10 text-center lg:text-left">
                <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/50 border border-white shadow-sm">
                    <span class="w-2 h-2 rounded-full bg-[var(--qroo-gold)]"></span>
                    <span class="text-[10px] font-bold text-[var(--qroo-slate)] uppercase tracking-widest">Plataforma Oficial del Censo Deportivo</span>
                </div>
                
                <h1 class="text-6xl lg:text-8xl font-black text-[var(--qroo-slate)] tracking-tighter leading-[0.9] uppercase">
                    Sistema de <br>
                    <span class="text-[var(--qroo-maroon)]">Registro </span> <br>
                    Técnico.
                </h1>
                
                <p class="text-lg text-gray-500 max-w-lg leading-relaxed font-light">
                    Bienvenido a la infraestructura digital del Municipio de Bacalar. Una herramienta diseñada para la gestión de entrenadores y atletas.
                </p>

                <div class="flex flex-col sm:flex-row items-center gap-6 justify-center lg:justify-start">
                    <a href="<?php echo BASE_URL; ?>/modules/auth/login.php" class="btn btn-lg bg-gradient-to-r from-[var(--qroo-maroon)] to-[var(--qroo-maroon-dark)] text-white border-none h-16 px-12 rounded-3xl shadow-2xl hover:scale-105 transition-all group">
                        <span class="text-xs uppercase tracking-[0.2em] font-black">Ingreso Institucional</span>
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7-7 7" /></svg>
                    </a>
                </div>
                
                <div class="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start mt-6">
                    <a href="<?php echo BASE_URL; ?>/modules/auth/register.php?type=deportista" class="text-xs font-black uppercase tracking-[0.2em] text-[var(--qroo-slate)] hover:text-[var(--qroo-maroon)] transition-colors flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM7 20a4 4 0 00-4-4v0a4 4 0 014-4v0a4 4 0 014 4v0a4 4 0 01-4 4z" /></svg>
                        Registrarme como Deportista
                    </a>
                    <span class="text-gray-300">|</span>
                    <a href="<?php echo BASE_URL; ?>/modules/auth/register.php" class="text-xs font-black uppercase tracking-[0.2em] text-[var(--qroo-gold)] hover:underline">Registrar Nuevo Entrenador</a>
                </div>
            </div>

            <!-- Visual Asset Area -->
            <div class="hidden lg:block relative">
                <div class="glass-card p-10 rounded-[3rem] shadow-premium relative z-10 border border-white/60">
                    <div class="grid grid-cols-2 gap-6">
                        <div class="space-y-6">
                             <div class="h-40 bg-gradient-to-br from-gray-50 to-white rounded-3xl border border-white shadow-sm p-6 flex flex-col justify-between">
                                <div class="w-10 h-10 rounded-xl bg-[var(--qroo-maroon)]/10 flex items-center justify-center text-[var(--qroo-maroon)]">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                </div>
                                <div class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Entrenadores</div>
                                <div class="text-3xl font-black text-[var(--qroo-slate)]"><?php echo $countTrainers; ?> <span class="text-xs text-gray-400 font-bold">Activos</span></div>
                             </div>
                             <div class="h-32 bg-[var(--qroo-slate)] rounded-3xl p-6 flex flex-col justify-end text-white relative overflow-hidden">
                                <div class="absolute top-0 right-0 p-4 opacity-10">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                </div>
                                <div class="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1">Instalaciones</div>
                                <div class="text-2xl font-black"><?php echo $countSpaces; ?> Áreas</div>
                             </div>
                        </div>
                        <div class="space-y-6 pt-12">
                            <div class="h-32 bg-[var(--qroo-gold)] rounded-3xl p-6 flex flex-col justify-end text-white shadow-xl shadow-qroo-gold/20">
                                <div class="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1">Censo Atletas</div>
                                <div class="text-3xl font-black tracking-tighter"><?php echo $countAthletes; ?></div>
                             </div>
                             <div class="h-40 bg-white rounded-3xl border border-gray-100 shadow-xl p-8 flex flex-col items-center justify-center gap-3">
                                <div class="w-12 h-12 rounded-full bg-[var(--qroo-maroon)]/5 flex items-center justify-center text-[var(--qroo-maroon)]">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                </div>
                                <div class="text-sm font-black text-[var(--qroo-slate)]"><?php echo $countDisciplines; ?> Disciplinas</div>
                                <div class="text-[9px] font-black text-gray-300 uppercase tracking-widest text-center">Gestión Técnica<br>Interconectada</div>
                             </div>
                        </div>
                    </div>
                </div>
                <!-- Decorative Elements -->
                <div class="absolute -top-10 -right-10 w-32 h-32 bg-[var(--qroo-gold)]/20 rounded-full blur-3xl"></div>
                <div class="absolute -bottom-10 -left-10 w-32 h-32 bg-[var(--qroo-maroon)]/20 rounded-full blur-3xl"></div>
            </div>
        </div>
    </main>

    <!-- Footer -->
    <footer class="px-8 lg:px-20 py-10 border-t border-gray-100 bg-white/30 backdrop-blur-sm">
        <div class="flex flex-col md:flex-row justify-between items-center gap-6">
            <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center md:text-left">
                © <?php echo date('Y'); ?> Municipio de Bacalar. <br class="md:hidden"> Todos los derechos reservados.
            </p>
            <div class="flex gap-8">
                <a href="#" class="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-[var(--qroo-slate)] transition-colors">Aviso de Privacidad</a>
                <a href="#" class="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-[var(--qroo-slate)] transition-colors">Contacto</a>
            </div>
        </div>
    </footer>

</body>
</html>
