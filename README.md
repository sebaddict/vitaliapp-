# ⚡ VitaliApp

**App deportiva comunitaria — Zona Norte, Buenos Aires**

> "Energía que te conecta" — Manual de Marca v1.0

---

## Stack Técnico

| Capa | Tech |
|---|---|
| App móvil | Expo SDK 53 / React Native 0.79 |
| Backend | Supabase (Auth + PostgreSQL + Realtime) |
| Landing | HTML estático → Vercel |
| Build | EAS Build (Expo Application Services) |
| Notificaciones | Supabase DB Notifications + Edge Functions |

---

## Estructura del proyecto

```
vitaliapp/
├── App.js                 ← App principal (single file)
├── app.json               ← Config Expo + iOS/Android
├── eas.json               ← Config EAS Build
├── package.json           ← Dependencias
└── assets/
    ├── icon.png           ← 1024x1024 fondo negro, ⚡ naranja
    ├── splash.png         ← 1242x2436 fondo negro
    ├── adaptive-icon.png  ← 1024x1024 para Android
    └── favicon.png        ← 32x32 para web
```

---

## Setup local

```bash
# 1. Clonar el repo
git clone https://github.com/sebaddict/vitaliapp-.git
cd vitaliapp-

# 2. Instalar dependencias
npm install

# 3. Iniciar en Expo Go
npx expo start
```

---

## Variables de entorno (ya configuradas en app.json)

```
SUPABASE_URL=https://qjutbnewvkhdjmjdiges.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
```

---

## Build para stores

### Preview (APK para testear)
```bash
eas build --platform android --profile preview
```

### Producción Android (AAB para Play Store)
```bash
eas build --platform android --profile production
```

### Producción iOS (IPA para App Store)
```bash
eas build --platform ios --profile production
```

---

## Supabase — Tablas principales

| Tabla | Descripción |
|---|---|
| `profiles` | Perfiles de usuarios con zona y deportes |
| `events` | Eventos deportivos (partido/clase/cancha) |
| `event_participants` | Solicitudes con flujo aprobación |
| `notifications` | Notificaciones in-app |
| `waitlist` | Lista de espera (landing) |
| `centers` | Centros deportivos verificados |
| `bookings` | Reservas y pagos |
| `achievements` | Logros y gamificación |

---

## Edge Functions deployadas

| Función | Descripción |
|---|---|
| `notify-participant` | Notifica aprobación/rechazo al participante |

---

## Colores — Manual de Marca v1.0

```
--vitali-orange: #FF6B00   ← Acción primaria
--vitali-black:  #000000   ← Fondo base
--vitali-dark:   #1A1A1A   ← Superficies
--vitali-mid:    #333333   ← Bordes
--vitali-white:  #FFFFFF   ← Texto primario
--vitali-muted:  #888888   ← Texto secundario
```

Tipografía: **Montserrat 800** (headings) · **Inter/System** (cuerpo)

---

## Links

- 🌐 Landing: [vitaliapp.vercel.app](https://vitaliapp.vercel.app)
- 📱 Expo Snack: [snack.expo.dev/@sebaddict/vitaliapp](https://snack.expo.dev/@sebaddict/vitaliapp)
- 🗄️ Supabase: [vitaliapp-prod](https://supabase.com/dashboard/project/qjutbnewvkhdjmjdiges)

---

*VitaliApp · Zona Norte · Buenos Aires · 2026*
