/**
 * Script para capturar screenshots de todas las vistas del sistema
 * Usa puppeteer-core con el Chrome del sistema (macOS)
 * Inyecta un token ficticio en localStorage para bypassar ProtectedRoute
 */

import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = 'http://localhost:5173';
const OUTPUT_DIR = path.join(__dirname, '..', 'screenshots');

// Usuario ficticio para bypassar auth (AuthContext lee de localStorage)
const FAKE_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake';
const FAKE_USER_MEDICO = JSON.stringify({
  id: 1,
  name: 'Dr. Giomar Ortega',
  email: 'medico@parkinson.pe',
  role: 'MEDICO',
  active: true,
});
const FAKE_USER_ADMIN = JSON.stringify({
  id: 2,
  name: 'Admin Diego Vega',
  email: 'admin@parkinson.pe',
  role: 'ADMIN',
  active: true,
});

// Vistas a capturar
const VIEWS = [
  {
    id: 'HU01_login',
    label: 'Login - Inicio de sesión',
    hu: ['HU-01'],
    url: '/login',
    role: null, // no inject auth
    description: 'Página de autenticación del sistema',
  },
  {
    id: 'HU01_HU02_dashboard',
    label: 'Dashboard principal',
    hu: ['HU-01', 'HU-02'],
    url: '/',
    role: 'MEDICO',
    description: 'Panel principal con estadísticas y acceso por rol MÉDICO',
  },
  {
    id: 'HU03_HU04_patients_list',
    label: 'Lista de pacientes',
    hu: ['HU-03', 'HU-04'],
    url: '/patients',
    role: 'MEDICO',
    description: 'Búsqueda, listado y visualización de pacientes',
  },
  {
    id: 'HU03_patient_form',
    label: 'Formulario nuevo paciente',
    hu: ['HU-03'],
    url: '/patients?new=true',
    role: 'MEDICO',
    description: 'Formulario de registro de nuevo paciente',
  },
  {
    id: 'HU05_HU06_HU07_HU08_recording',
    label: 'Nueva grabación de voz',
    hu: ['HU-05', 'HU-06', 'HU-07', 'HU-08'],
    url: '/recordings/new',
    role: 'MEDICO',
    description: 'Captura de audio, validación, almacenamiento y transcripción',
  },
  {
    id: 'HU01_HU02_users',
    label: 'Gestión de usuarios',
    hu: ['HU-01', 'HU-02'],
    url: '/users',
    role: 'ADMIN',
    description: 'Administración de usuarios y control de roles',
  },
  {
    id: 'HU19_thresholds',
    label: 'Configuración de umbrales de riesgo',
    hu: ['HU-19'],
    url: '/settings/thresholds',
    role: 'ADMIN',
    description: 'Configuración de umbrales de riesgo para diagnóstico',
  },
  {
    id: 'HU20_backups',
    label: 'Respaldo de datos',
    hu: ['HU-20'],
    url: '/backups',
    role: 'ADMIN',
    description: 'Gestión de respaldos automáticos del sistema',
  },
  {
    id: 'HU18_audit',
    label: 'Logs de auditoría',
    hu: ['HU-18'],
    url: '/audit',
    role: 'ADMIN',
    description: 'Registro y visualización de logs de auditoría',
  },
];

async function injectAuth(page, role) {
  const user = role === 'ADMIN' ? FAKE_USER_ADMIN : FAKE_USER_MEDICO;
  await page.evaluate(
    ({ token, userJson }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', userJson);
    },
    { token: FAKE_TOKEN, userJson: user }
  );
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log('🚀 Iniciando Chrome...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1440,900',
      '--use-fake-ui-for-media-stream', // allow mic without popup
      '--use-fake-device-for-media-stream',
    ],
    defaultViewport: { width: 1440, height: 900 },
  });

  const results = [];

  for (const view of VIEWS) {
    console.log(`\n📸 Capturando: ${view.label} (${view.hu.join(', ')})`);

    const page = await browser.newPage();

    try {
      // Para vistas protegidas: ir primero al home para que localStorage esté disponible
      if (view.role) {
        await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 10000 });
        await injectAuth(page, view.role);
      }

      // Navegar a la vista objetivo
      await page.goto(BASE_URL + view.url, { waitUntil: 'networkidle0', timeout: 15000 });

      // Esperar que el contenido cargue
      await new Promise(resolve => setTimeout(resolve, 2000));

      const filename = `${view.id}.png`;
      const filepath = path.join(OUTPUT_DIR, filename);
      await page.screenshot({ path: filepath, fullPage: false });

      console.log(`   ✅ Guardado: ${filepath}`);
      results.push({ ...view, file: filename, status: 'OK' });
    } catch (err) {
      console.error(`   ❌ Error: ${err.message}`);
      results.push({ ...view, file: null, status: 'ERROR', error: err.message });
    } finally {
      await page.close();
    }
  }

  await browser.close();

  // Generar reporte
  console.log('\n\n========== RESUMEN DE VISTAS ==========');
  for (const r of results) {
    const icon = r.status === 'OK' ? '✅' : '❌';
    console.log(`${icon} [${r.hu.join('/')}] ${r.label}`);
    if (r.file) console.log(`     → screenshots/${r.file}`);
    if (r.error) console.log(`     Error: ${r.error}`);
  }
  console.log('=======================================');

  return results;
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
