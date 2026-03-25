// ============================================================
// VITALIAPP — App.js v4.0
// ✅ Geolocalización real — eventos ordenados por distancia
// ✅ Montserrat · Manual de Marca v1.0
// ✅ Supabase: vitaliapp-prod
// ✅ Edge Function: nearby-events
// ✅ 14 eventos · 10 zonas · 9 deportes
// ============================================================

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Animated, Dimensions, StatusBar, SafeAreaView,
  TextInput, ActivityIndicator, Alert, Image,
  KeyboardAvoidingView, Platform, RefreshControl, FlatList,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import * as Location from "expo-location";

// ─────────────────────────────────────────────
// SUPABASE
// ─────────────────────────────────────────────
const SB_URL = "https://qjutbnewvkhdjmjdiges.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqdXRibmV3dmtoZGptamRpZ2VzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMjMxODAsImV4cCI6MjA4OTY5OTE4MH0.CjQa5BLBrXjEP-oIhHNPbeE20l72v2Dz30SqWJdmpV8";
const NEARBY_FN = `${SB_URL}/functions/v1/nearby-events`;

const supabase = createClient(SB_URL, SB_KEY, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});

// ─────────────────────────────────────────────
// DESIGN TOKENS — Manual de Marca v1.0
// ─────────────────────────────────────────────
const C = {
  orange: "#FF6B00", orange2: "#FF8C33", orangeDim: "#FF6B0018",
  black: "#000000", dark: "#1A1A1A", mid: "#333333",
  white: "#FFFFFF", muted: "#888888",
  green: "#00C2A8", greenDim: "#00C2A810",
  red: "#FF4040", redDim: "#FF404010",
  radiusSm: 8, radiusMd: 12,
};
const { width: SW } = Dimensions.get("window");

const SPORT_ICONS  = { futbol:"⚽",basquet:"🏀",tenis:"🎾",padel:"🏓",running:"🏃",ciclismo:"🚴",yoga:"🧘",natacion:"🏊",voley:"🏐",otro:"🏅" };
const SPORT_LABELS = { futbol:"Fútbol",basquet:"Básquet",tenis:"Tenis",padel:"Padel",running:"Running",ciclismo:"Ciclismo",yoga:"Yoga",natacion:"Natación",voley:"Voley",otro:"Otro" };
const ZONA_LABELS  = { tigre:"Tigre",nordelta:"Nordelta",pilar:"Pilar",san_isidro:"San Isidro",san_fernando:"San Fernando",vicente_lopez:"Vicente López",olivos:"Olivos",martinez:"Martínez",acassuso:"Acassuso",beccar:"Beccar",general_pacheco:"Gral. Pacheco",otro:"Otra zona" };

// ─────────────────────────────────────────────
// HOOKS
// ─────────────────────────────────────────────
function useAuth() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadProfile(session.user.id);
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s) loadProfile(s.user.id);
      else { setProfile(null); setLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (uid) => {
    const { data } = await supabase.from("profiles").select("*").eq("id", uid).single();
    setProfile(data); setLoading(false);
  };

  return { session, profile, loading, signOut: () => supabase.auth.signOut() };
}

// Hook de geolocalización
function useGeoLocation() {
  const [coords, setCoords]   = useState(null);
  const [geoError, setGeoError] = useState(null);
  const [geoLoading, setGeoLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setGeoError("Permiso de ubicación denegado");
          // Usar coordenadas por defecto: Tigre, Zona Norte
          setCoords({ latitude: -34.4261, longitude: -58.5795 });
          setGeoLoading(false);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      } catch (e) {
        setGeoError("No se pudo obtener ubicación");
        setCoords({ latitude: -34.4261, longitude: -58.5795 }); // fallback Tigre
      } finally {
        setGeoLoading(false);
      }
    })();
  }, []);

  return { coords, geoError, geoLoading };
}

// Feed con geolocalización
function useNearbyFeed(coords, sportFilter, radius = 30) {
  const [events, setEvents]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = useCallback(async (quiet = false) => {
    if (!coords) return;
    quiet ? setRefreshing(true) : setLoading(true);

    try {
      const params = new URLSearchParams({
        lat: coords.latitude.toString(),
        lng: coords.longitude.toString(),
        radius: radius.toString(),
        ...(sportFilter ? { sport: sportFilter } : {}),
      });

      const res = await global.fetch(`${NEARBY_FN}?${params}`, {
        headers: { "apikey": SB_KEY, "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.events) setEvents(data.events);
    } catch {
      // Fallback al feed_events normal
      let q = supabase.from("feed_events").select("*").order("starts_at").limit(30);
      if (sportFilter) q = q.eq("sport", sportFilter);
      const { data } = await q;
      if (data) setEvents(data);
    }

    setLoading(false); setRefreshing(false);
  }, [coords, sportFilter, radius]);

  useEffect(() => { if (coords) fetch(); }, [fetch]);

  return { events, loading, refreshing, refetch: () => fetch(true) };
}

function useNotifications(userId) {
  const [notifs, setNotifs] = useState([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      const { data } = await supabase.from("notifications")
        .select("*").eq("user_id", userId)
        .order("created_at", { ascending: false }).limit(20);
      if (data) { setNotifs(data); setUnread(data.filter(n => !n.read).length); }
    };
    load();
    const ch = supabase.channel("notifs-" + userId)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => { setNotifs(p => [payload.new, ...p]); setUnread(u => u + 1); }
      ).subscribe();
    return () => supabase.removeChannel(ch);
  }, [userId]);

  const markRead = async () => {
    await supabase.from("notifications").update({ read: true }).eq("user_id", userId);
    setUnread(0); setNotifs(p => p.map(n => ({ ...n, read: true })));
  };

  return { notifs, unread, markRead };
}

// ─────────────────────────────────────────────
// UI ATOMS
// ─────────────────────────────────────────────
function Loader({ text = "Cargando..." }) {
  return (
    <View style={{ flex:1, alignItems:"center", justifyContent:"center", backgroundColor:C.black }}>
      <ActivityIndicator size="large" color={C.orange} />
      <Text style={[u.muted, { marginTop:12 }]}>{text}</Text>
    </View>
  );
}

function VInput({ label, style, ...props }) {
  return (
    <View style={{ marginBottom:16 }}>
      {label && <Text style={u.lbl}>{label}</Text>}
      <TextInput style={[u.input, style]} placeholderTextColor={C.muted} {...props} />
    </View>
  );
}

function OBtn({ title, onPress, busy, style, small }) {
  return (
    <TouchableOpacity
      style={[u.oBtn, small && { paddingVertical:10, paddingHorizontal:16 }, style]}
      onPress={onPress} activeOpacity={0.85} disabled={busy}>
      {busy ? <ActivityIndicator color={C.black} size="small" />
            : <Text style={[u.oBtnText, small && { fontSize:12 }]}>{title}</Text>}
    </TouchableOpacity>
  );
}

function Chip({ label, active, onPress }) {
  return (
    <TouchableOpacity style={[u.chip, active && u.chipActive]} onPress={onPress}>
      <Text style={[u.chipTxt, active && { color:C.orange }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────
// SPLASH
// ─────────────────────────────────────────────
function Splash({ onEnter }) {
  const fade  = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  const slide = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fade,  { toValue:1, duration:700, useNativeDriver:true }),
        Animated.spring(scale, { toValue:1, tension:60, friction:7, useNativeDriver:true }),
      ]),
      Animated.timing(slide, { toValue:0, duration:400, useNativeDriver:true }),
    ]).start();
  }, []);

  return (
    <View style={s.splash}>
      <StatusBar barStyle="light-content" backgroundColor={C.black} />
      <View style={s.splashGlow} />
      <Animated.View style={{ opacity:fade, transform:[{scale}], alignItems:"center" }}>
        <View style={s.logoMark}><Text style={{ fontSize:40 }}>⚡</Text></View>
        <Text style={s.logoWord}>VITALIAPP</Text>
        <Text style={s.logoSub}>ENERGÍA QUE TE CONECTA</Text>
      </Animated.View>
      <Animated.View style={[{ width:"100%", alignItems:"center" }, { opacity:fade, transform:[{translateY:slide}] }]}>
        <Text style={s.splashHero}>TU DEPORTE,{"\n"}TU BARRIO.</Text>
        <OBtn title="EMPEZAR →" onPress={onEnter} style={{ width:"100%", marginTop:32 }} />
        <Text style={[u.muted, { marginTop:14, fontSize:11 }]}>Zona Norte · Buenos Aires</Text>
      </Animated.View>
    </View>
  );
}

// ─────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────
function Auth() {
  const [mode, setMode]       = useState("login");
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [name, setName]       = useState("");
  const [busy, setBusy]       = useState(false);
  const [zona, setZona]       = useState(null);
  const [sports, setSports]   = useState([]);
  const [level, setLevel]     = useState(null);

  const login = async () => {
    if (!email || !password) return Alert.alert("Completá email y contraseña");
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) Alert.alert("Error", error.message);
    setBusy(false);
  };

  const register = async () => {
    if (!email || !password || !name) return Alert.alert("Completá todos los campos");
    setBusy(true);
    const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
    if (error) Alert.alert("Error", error.message);
    else setMode("onboarding");
    setBusy(false);
  };

  const saveProfile = async () => {
    if (!zona || sports.length === 0 || !level) return Alert.alert("Completá tu perfil");
    setBusy(true);
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from("profiles").update({ zona, sports, skill_level: level }).eq("id", session.user.id);
    setBusy(false);
  };

  if (mode === "onboarding") return (
    <SafeAreaView style={{ flex:1, backgroundColor:C.black }}>
      <ScrollView contentContainerStyle={{ padding:24, paddingTop:40 }}>
        <Text style={u.h1}>Tu perfil ⚡</Text>
        <Text style={[u.muted, { marginBottom:28 }]}>Así te mostramos eventos relevantes</Text>
        <Text style={u.lbl}>¿Dónde jugás?</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:20 }}>
          {Object.entries(ZONA_LABELS).map(([k,v]) => <Chip key={k} label={v} active={zona===k} onPress={() => setZona(k)} />)}
          <View style={{ width:16 }} />
        </ScrollView>
        <Text style={u.lbl}>¿Qué deportes?</Text>
        <View style={{ flexDirection:"row", flexWrap:"wrap", gap:10, marginBottom:20 }}>
          {Object.entries(SPORT_ICONS).map(([k,icon]) => (
            <TouchableOpacity key={k}
              style={[s.sportGridItem, sports.includes(k) && s.sportGridItemActive]}
              onPress={() => setSports(p => p.includes(k) ? p.filter(x => x!==k) : [...p,k])}>
              <Text style={{ fontSize:24 }}>{icon}</Text>
              <Text style={[u.muted, { fontSize:11, marginTop:4 }, sports.includes(k) && { color:C.orange }]}>{SPORT_LABELS[k]}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={u.lbl}>Nivel</Text>
        <View style={{ flexDirection:"row", gap:10, marginBottom:32 }}>
          {["principiante","intermedio","avanzado"].map(l => (
            <TouchableOpacity key={l} style={[s.levelBtn, level===l && s.levelBtnActive]} onPress={() => setLevel(l)}>
              <Text style={[s.levelTxt, level===l && { color:C.orange }]}>{l.charAt(0).toUpperCase()+l.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <OBtn title="COMPLETAR PERFIL →" onPress={saveProfile} busy={busy} />
      </ScrollView>
    </SafeAreaView>
  );

  return (
    <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS==="ios"?"padding":undefined}>
      <SafeAreaView style={{ flex:1, backgroundColor:C.black }}>
        <ScrollView contentContainerStyle={{ padding:24, paddingTop:60 }}>
          <View style={{ alignItems:"center", marginBottom:36 }}>
            <View style={s.logoMark}><Text style={{ fontSize:40 }}>⚡</Text></View>
            <Text style={s.logoWord}>VITALIAPP</Text>
          </View>
          <Text style={u.h1}>{mode==="login"?"Bienvenido de vuelta":"Crear cuenta"}</Text>
          {mode==="register" && <VInput label="Nombre" value={name} onChangeText={setName} placeholder="Tu nombre" />}
          <VInput label="Email" value={email} onChangeText={setEmail} placeholder="tu@email.com" keyboardType="email-address" autoCapitalize="none" />
          <VInput label="Contraseña" value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry />
          <OBtn title={mode==="login"?"INGRESAR →":"CREAR CUENTA →"} onPress={mode==="login"?login:register} busy={busy} style={{ marginTop:8 }} />
          <TouchableOpacity onPress={() => setMode(mode==="login"?"register":"login")} style={{ marginTop:20, alignItems:"center" }}>
            <Text style={u.muted}>{mode==="login"?"¿No tenés cuenta? Registrate":"¿Ya tenés cuenta? Ingresá"}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────
// HOME — con geolocalización
// ─────────────────────────────────────────────
function Home({ profile, onSignOut, onOpenEvent, onCreateEvent, onOpenNotifs, unread }) {
  const [sport, setSport]     = useState(null);
  const [radius, setRadius]   = useState(30);
  const { coords, geoError, geoLoading } = useGeoLocation();
  const { events, loading, refreshing, refetch } = useNearbyFeed(coords, sport, radius);

  const nearbyCount = events.filter(e => e.distance_km !== undefined && e.distance_km <= 5).length;

  return (
    <SafeAreaView style={{ flex:1, backgroundColor:C.black }}>
      <StatusBar barStyle="light-content" backgroundColor={C.black} />

      {/* TOP BAR */}
      <View style={s.topBar}>
        <View>
          <Text style={s.topGreet}>Hola, {profile?.full_name?.split(" ")[0]||"atleta"} 👋</Text>
          <View style={{ flexDirection:"row", alignItems:"center", gap:4 }}>
            <Text style={{ fontSize:10 }}>{geoLoading ? "📡" : geoError ? "📍" : "🟢"}</Text>
            <Text style={s.topZona}>
              {geoLoading ? "Obteniendo ubicación..." : geoError ? `${ZONA_LABELS[profile?.zona]||"Zona Norte"}` : `Tu ubicación · ${events.length} eventos`}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection:"row", alignItems:"center", gap:12 }}>
          <TouchableOpacity onPress={onOpenNotifs} style={{ position:"relative" }}>
            <Text style={{ fontSize:22 }}>🔔</Text>
            {unread > 0 && (
              <View style={s.notifBadge}><Text style={{ color:C.white, fontSize:9, fontWeight:"800" }}>{unread}</Text></View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={s.avatar} onLongPress={onSignOut}>
            <Text style={s.avatarTxt}>{(profile?.full_name||"V")[0].toUpperCase()}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* STATS */}
      <View style={s.statsRow}>
        <StatBox value={events.length.toString()} label="Eventos" />
        <View style={{ width:1, backgroundColor:C.mid }} />
        <StatBox value={nearbyCount > 0 ? `${nearbyCount}` : (events[0]?.distance_km ? `${events[0].distance_km}km` : "—")} label={nearbyCount > 0 ? "< 5km" : "Más cercano"} />
        <View style={{ width:1, backgroundColor:C.mid }} />
        <StatBox value={`${radius}km`} label="Radio" orange />
      </View>

      {/* RADIO SELECTOR */}
      <View style={{ flexDirection:"row", gap:8, paddingHorizontal:20, marginTop:12 }}>
        {[10,20,30,50].map(r => (
          <TouchableOpacity key={r}
            style={[{ backgroundColor: radius===r ? C.orange : C.dark, borderRadius:C.radiusSm, paddingHorizontal:14, paddingVertical:6, borderWidth:1, borderColor: radius===r ? C.orange : C.mid }]}
            onPress={() => setRadius(r)}>
            <Text style={{ color: radius===r ? C.black : C.muted, fontSize:12, fontWeight:"700" }}>{r}km</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom:100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={C.orange} />}
      >
        {/* SPORT FILTER */}
        <View style={{ paddingHorizontal:20, marginTop:16 }}>
          <Text style={u.secLabel}>DEPORTES</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop:10 }}>
            <TouchableOpacity style={[s.sportChip, !sport && s.sportChipActive]} onPress={() => setSport(null)}>
              <Text style={s.sportChipIcon}>🏟</Text>
              <Text style={[s.sportChipLbl, !sport && { color:C.orange }]}>Todos</Text>
            </TouchableOpacity>
            {Object.keys(SPORT_ICONS).map(k => {
              const active = sport===k;
              const cnt = events.filter(e => e.sport===k).length;
              if (!active && cnt===0) return null;
              return (
                <TouchableOpacity key={k} style={[s.sportChip, active && s.sportChipActive]} onPress={() => setSport(active?null:k)}>
                  <Text style={s.sportChipIcon}>{SPORT_ICONS[k]}</Text>
                  <Text style={[s.sportChipLbl, active && { color:C.orange }]}>{SPORT_LABELS[k]}</Text>
                  {cnt > 0 && (
                    <View style={[s.badge, active && { backgroundColor:C.orange }]}>
                      <Text style={[{ fontSize:10, color:C.muted, fontWeight:"700" }, active && { color:C.black }]}>{cnt}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
            <View style={{ width:16 }} />
          </ScrollView>
        </View>

        {/* FEED */}
        <View style={{ flexDirection:"row", justifyContent:"space-between", alignItems:"center", paddingHorizontal:20, marginTop:20, marginBottom:12 }}>
          <Text style={u.secLabel}>
            {coords && !geoError ? "CERCA TUYO AHORA" : "ZONA NORTE"}
          </Text>
          <Text style={u.muted}>{events.length} eventos</Text>
        </View>

        {geoLoading ? <Loader text="Obteniendo ubicación..." />
          : loading ? <Loader text="Buscando eventos cercanos..." />
          : events.length === 0 ? (
            <View style={{ alignItems:"center", paddingVertical:48 }}>
              <Text style={{ fontSize:48, marginBottom:12 }}>{sport?SPORT_ICONS[sport]:"🏟"}</Text>
              <Text style={u.muted}>Sin eventos en {radius}km</Text>
              <TouchableOpacity onPress={() => setRadius(r => Math.min(r + 20, 100))} style={{ marginTop:12 }}>
                <Text style={{ color:C.orange, fontWeight:"700" }}>Ampliar radio →</Text>
              </TouchableOpacity>
            </View>
          ) : events.map(ev => <EventCard key={ev.id} event={ev} onPress={() => onOpenEvent(ev)} />)
        }
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={s.fab} onPress={onCreateEvent} activeOpacity={0.85}>
        <Text style={s.fabTxt}>+ CREAR EVENTO</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function StatBox({ value, label, orange }) {
  return (
    <View style={{ flex:1, alignItems:"center" }}>
      <Text style={[{ fontWeight:"900", fontSize:20, color:C.white }, orange && { color:C.orange }]}>{value}</Text>
      <Text style={[u.muted, { fontSize:10, marginTop:2, fontWeight:"700", letterSpacing:1 }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────
// EVENT CARD — con distancia
// ─────────────────────────────────────────────
function EventCard({ event, onPress }) {
  const slots  = event.slots_available;
  const urgent = slots <= 2 && slots > 0;
  const full   = slots <= 0;
  const date   = new Date(event.starts_at).toLocaleDateString("es-AR", {
    weekday:"short", month:"short", day:"numeric", hour:"2-digit", minute:"2-digit"
  });
  const hasDistance = event.distance_km !== undefined && event.distance_km !== null;

  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.9}>
      <View style={{ flexDirection:"row", justifyContent:"space-between", alignItems:"flex-start" }}>
        <View style={{ flexDirection:"row", alignItems:"flex-start", flex:1 }}>
          <Text style={{ fontSize:28, marginRight:12, marginTop:2 }}>{SPORT_ICONS[event.sport]||"🏅"}</Text>
          <View style={{ flex:1 }}>
            <Text style={s.cardTitle} numberOfLines={1}>{event.title}</Text>
            <Text style={s.cardDate}>{date}</Text>
          </View>
        </View>
        <View style={{ alignItems:"flex-end", gap:4 }}>
          <View style={s.typeBadge}>
            <Text style={s.typeBadgeTxt}>
              {event.event_type==="partido"?"PARTIDO":event.event_type==="clase"?"CLASE":"CANCHA"}
            </Text>
          </View>
          {hasDistance && (
            <View style={{ backgroundColor:C.orangeDim, borderRadius:6, paddingHorizontal:8, paddingVertical:3 }}>
              <Text style={{ fontSize:11, color:C.orange, fontWeight:"700" }}>📍 {event.distance_km}km</Text>
            </View>
          )}
        </View>
      </View>

      <View style={{ flexDirection:"row", flexWrap:"wrap", marginTop:12, gap:6 }}>
        <View style={s.pill}><Text style={s.pillTxt}>📍 {event.address_public}</Text></View>
        <View style={s.pill}><Text style={s.pillTxt}>🏅 {event.skill_level}</Text></View>
        <View style={[s.pill, event.is_free && { backgroundColor:"#00C2A815" }]}>
          <Text style={[s.pillTxt, event.is_free && { color:C.green }]}>
            💰 {event.is_free?"Gratis":`$${Number(event.price).toLocaleString("es-AR")}`}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection:"row", justifyContent:"space-between", alignItems:"center", marginTop:14 }}>
        <View style={{ flexDirection:"row", alignItems:"center" }}>
          <View style={s.miniAvatar}>
            <Text style={{ color:C.black, fontWeight:"800", fontSize:10 }}>{(event.organizer_name||"V")[0].toUpperCase()}</Text>
          </View>
          <Text style={[u.muted, { fontSize:11, marginLeft:6 }]}>{event.organizer_name}</Text>
          {event.organizer_verified && <Text style={{ marginLeft:4, fontSize:11, color:C.orange }}>✓</Text>}
        </View>
        <View style={[s.slotBadge, urgent && { backgroundColor:"#FF6B0018" }, full && { backgroundColor:C.redDim }]}>
          <Text style={[s.slotTxt, urgent && { color:C.orange }, full && { color:C.red }]}>
            {full?"COMPLETO":urgent?`⚠ ${slots} lugar${slots>1?"es":""}`:` ${slots} lugares`}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────
// EVENT DETAIL
// ─────────────────────────────────────────────
function EventDetail({ event, userId, onBack }) {
  const [myStatus, setMyStatus]         = useState(null);
  const [message, setMessage]           = useState("");
  const [busy, setBusy]                 = useState(false);
  const [checking, setChecking]         = useState(true);
  const [participants, setParticipants] = useState([]);
  const isOrg = event.organizer_id === userId;

  useEffect(() => { checkStatus(); if (isOrg) loadParticipants(); }, []);

  const checkStatus = async () => {
    const { data } = await supabase.from("event_participants")
      .select("status").eq("event_id", event.id).eq("user_id", userId).single();
    setMyStatus(data?.status || null); setChecking(false);
  };

  const loadParticipants = async () => {
    const { data } = await supabase.from("event_participants")
      .select("*, profiles(full_name, skill_level, zona)")
      .eq("event_id", event.id).order("joined_at");
    setParticipants(data || []);
  };

  const requestJoin = async () => {
    setBusy(true);
    const { error } = await supabase.from("event_participants")
      .insert({ event_id:event.id, user_id:userId, message });
    if (error) Alert.alert("Error", error.message);
    else setMyStatus("pendiente");
    setBusy(false);
  };

  const cancel = async () => {
    setBusy(true);
    await supabase.from("event_participants").update({ status:"retirado" })
      .eq("event_id", event.id).eq("user_id", userId);
    setMyStatus("retirado"); setBusy(false);
  };

  const approve = async (id) => {
    await supabase.from("event_participants").update({ status:"aprobado" }).eq("id", id);
    loadParticipants();
  };

  const reject = async (id) => {
    await supabase.from("event_participants").update({ status:"rechazado" }).eq("id", id);
    loadParticipants();
  };

  const dateStr = new Date(event.starts_at).toLocaleDateString("es-AR", {
    weekday:"long", year:"numeric", month:"long", day:"numeric", hour:"2-digit", minute:"2-digit"
  });

  return (
    <SafeAreaView style={{ flex:1, backgroundColor:C.black }}>
      <StatusBar barStyle="light-content" backgroundColor={C.black} />
      <ScrollView contentContainerStyle={{ paddingBottom:180 }}>
        <View style={{ flexDirection:"row", justifyContent:"space-between", alignItems:"center", padding:20 }}>
          <TouchableOpacity onPress={onBack} style={{ width:40, height:40, justifyContent:"center" }}>
            <Text style={{ fontSize:22, color:C.white }}>←</Text>
          </TouchableOpacity>
          <Text style={{ color:C.orange, fontSize:11, fontWeight:"700", letterSpacing:2 }}>
            {event.event_type?.toUpperCase()} {event.distance_km ? `· ${event.distance_km}km` : ""}
          </Text>
        </View>
        <View style={{ alignItems:"center", paddingVertical:20, paddingHorizontal:20 }}>
          <Text style={{ fontSize:56, marginBottom:12 }}>{SPORT_ICONS[event.sport]}</Text>
          <Text style={[u.h1, { textAlign:"center", fontSize:24 }]}>{event.title}</Text>
          <Text style={{ color:C.orange, fontWeight:"700", marginTop:8, textAlign:"center" }}>{dateStr}</Text>
        </View>
        <View style={{ flexDirection:"row", flexWrap:"wrap", gap:10, paddingHorizontal:20 }}>
          <InfoCell icon="📍" label="Zona" value={event.address_public} />
          {myStatus==="aprobado" && event.address_exact && <InfoCell icon="🗺" label="Dirección exacta" value={event.address_exact} orange />}
          <InfoCell icon="🏅" label="Nivel" value={event.skill_level} />
          <InfoCell icon="👥" label="Jugadores" value={`${event.current_players}/${event.max_players}`} />
          <InfoCell icon="💰" label="Precio" value={event.is_free?"Gratis":`$${Number(event.price).toLocaleString("es-AR")}`} />
          {event.distance_km && <InfoCell icon="📡" label="Distancia" value={`${event.distance_km} km`} orange />}
        </View>
        {event.description && (
          <View style={{ paddingHorizontal:20, marginTop:24 }}>
            <Text style={u.secLabel}>DESCRIPCIÓN</Text>
            <Text style={[u.muted, { marginTop:8, lineHeight:22 }]}>{event.description}</Text>
          </View>
        )}
        {isOrg && participants.length > 0 && (
          <View style={{ paddingHorizontal:20, marginTop:24 }}>
            <Text style={u.secLabel}>SOLICITUDES ({participants.length})</Text>
            {participants.map(p => (
              <ParticipantRow key={p.id} p={p} onApprove={() => approve(p.id)} onReject={() => reject(p.id)} />
            ))}
          </View>
        )}
      </ScrollView>
      {!isOrg && !checking && (
        <View style={s.detailCTA}>
          {(!myStatus || myStatus==="retirado") ? (
            <>
              <TextInput style={[u.input, { marginBottom:12 }]}
                placeholder="Mensaje al organizador (opcional)"
                placeholderTextColor={C.muted} value={message} onChangeText={setMessage} multiline />
              <OBtn title="SOLICITAR UNIRME →" onPress={requestJoin} busy={busy} />
            </>
          ) : myStatus==="pendiente" ? (
            <View>
              <View style={s.statusBanner}><Text style={s.statusBannerTxt}>⏳ Esperando aprobación</Text></View>
              <TouchableOpacity onPress={cancel} style={{ alignItems:"center", marginTop:10 }}>
                <Text style={u.muted}>Cancelar solicitud</Text>
              </TouchableOpacity>
            </View>
          ) : myStatus==="aprobado" ? (
            <View style={[s.statusBanner, { backgroundColor:C.greenDim, borderColor:C.green }]}>
              <Text style={[s.statusBannerTxt, { color:C.green }]}>✓ ¡Estás adentro! Dirección desbloqueada</Text>
            </View>
          ) : myStatus==="rechazado" ? (
            <View style={[s.statusBanner, { backgroundColor:C.redDim, borderColor:C.red }]}>
              <Text style={[s.statusBannerTxt, { color:C.red }]}>Solicitud rechazada</Text>
            </View>
          ) : null}
        </View>
      )}
    </SafeAreaView>
  );
}

function InfoCell({ icon, label, value, orange }) {
  return (
    <View style={[s.infoCell, orange && { borderColor:C.orange }]}>
      <Text style={{ fontSize:20 }}>{icon}</Text>
      <Text style={[u.muted, { fontSize:11, marginTop:4 }]}>{label}</Text>
      <Text style={{ color:orange?C.orange:C.white, fontSize:13, fontWeight:"700", marginTop:2 }}>{value}</Text>
    </View>
  );
}

function ParticipantRow({ p, onApprove, onReject }) {
  const prof = p.profiles;
  const sc = { pendiente:C.orange, aprobado:C.green, rechazado:C.red, retirado:C.muted };
  return (
    <View style={{ flexDirection:"row", alignItems:"center", backgroundColor:C.dark, borderRadius:C.radiusSm, padding:12, marginTop:8 }}>
      <View style={s.miniAvatar}>
        <Text style={{ color:C.black, fontWeight:"800", fontSize:12 }}>{(prof?.full_name||"?")[0].toUpperCase()}</Text>
      </View>
      <View style={{ flex:1, marginLeft:10 }}>
        <Text style={{ color:C.white, fontWeight:"700", fontSize:13 }}>{prof?.full_name}</Text>
        <Text style={u.muted}>{prof?.zona?ZONA_LABELS[prof.zona]:""} · {prof?.skill_level}</Text>
        {p.message && <Text style={[u.muted, { fontSize:11, marginTop:2, fontStyle:"italic" }]}>"{p.message}"</Text>}
      </View>
      {p.status==="pendiente" ? (
        <View style={{ flexDirection:"row", gap:8 }}>
          <TouchableOpacity style={[s.actionBtn, { backgroundColor:C.greenDim }]} onPress={onApprove}>
            <Text style={{ color:C.green, fontSize:18 }}>✓</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.actionBtn, { backgroundColor:C.redDim }]} onPress={onReject}>
            <Text style={{ color:C.red, fontSize:18 }}>✕</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={{ color:sc[p.status]||C.muted, fontSize:11, fontWeight:"700" }}>{p.status.toUpperCase()}</Text>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────
// CREATE EVENT
// ─────────────────────────────────────────────
function CreateEvent({ profile, coords, onBack, onDone }) {
  const [f, setF] = useState({
    event_type:"partido", sport:"futbol", title:"", description:"",
    skill_level:"todos", zona:profile?.zona||"tigre",
    address_public:"", address_exact:"",
    max_players:"10", is_free:true, price:"0", date:"", time:"",
  });
  const [busy, setBusy] = useState(false);
  const set = (k,v) => setF(p => ({ ...p, [k]:v }));

  const create = async () => {
    if (!f.title || !f.address_public || !f.date || !f.time)
      return Alert.alert("Completá los campos obligatorios (*)");
    setBusy(true);
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase.from("events").insert({
      organizer_id: session.user.id,
      event_type: f.event_type, sport: f.sport,
      title: f.title, description: f.description,
      skill_level: f.skill_level, zona: f.zona,
      address_public: f.address_public, address_exact: f.address_exact,
      max_players: parseInt(f.max_players)||10,
      is_free: f.is_free, price: f.is_free ? 0 : parseFloat(f.price)||0,
      starts_at: new Date(`${f.date}T${f.time}:00`).toISOString(),
      // Usar coords del usuario como ubicación del evento
      lat: coords?.latitude || null,
      lng: coords?.longitude || null,
    });
    if (error) Alert.alert("Error", error.message);
    else { Alert.alert("¡Evento publicado! ⚡"); onDone(); }
    setBusy(false);
  };

  return (
    <SafeAreaView style={{ flex:1, backgroundColor:C.black }}>
      <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS==="ios"?"padding":undefined}>
        <ScrollView contentContainerStyle={{ padding:20, paddingBottom:60 }}>
          <View style={{ flexDirection:"row", alignItems:"center", marginBottom:24 }}>
            <TouchableOpacity onPress={onBack} style={{ width:40, height:40, justifyContent:"center" }}>
              <Text style={{ fontSize:22, color:C.white }}>←</Text>
            </TouchableOpacity>
            <Text style={[u.h1, { flex:1, textAlign:"center", fontSize:20 }]}>Crear evento</Text>
          </View>
          <Text style={u.lbl}>Tipo</Text>
          <View style={{ flexDirection:"row", gap:10, marginBottom:20 }}>
            {[["partido","⚽ Partido"],["clase","🧘 Clase"],["cancha","🏟 Cancha"]].map(([k,l]) => (
              <TouchableOpacity key={k} style={[s.levelBtn, { flex:1 }, f.event_type===k&&s.levelBtnActive]} onPress={() => set("event_type",k)}>
                <Text style={[s.levelTxt, f.event_type===k&&{ color:C.orange }]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={u.lbl}>Deporte</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:16 }}>
            {Object.entries(SPORT_ICONS).map(([k,icon]) => (
              <TouchableOpacity key={k} style={[s.sportChip, f.sport===k&&s.sportChipActive]} onPress={() => set("sport",k)}>
                <Text style={s.sportChipIcon}>{icon}</Text>
                <Text style={[s.sportChipLbl, f.sport===k&&{ color:C.orange }]}>{SPORT_LABELS[k]}</Text>
              </TouchableOpacity>
            ))}
            <View style={{ width:16 }} />
          </ScrollView>
          <VInput label="Título *" value={f.title} onChangeText={v=>set("title",v)} placeholder="Ej: Fútbol 5 en Tigre" />
          <VInput label="Descripción" value={f.description} onChangeText={v=>set("description",v)} placeholder="Contá más..." multiline numberOfLines={3} />
          <Text style={u.lbl}>Zona *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:16 }}>
            {Object.entries(ZONA_LABELS).map(([k,v]) => <Chip key={k} label={v} active={f.zona===k} onPress={() => set("zona",k)} />)}
            <View style={{ width:16 }} />
          </ScrollView>
          <VInput label="Zona pública *" value={f.address_public} onChangeText={v=>set("address_public",v)} placeholder="Ej: Nordelta, Tigre" />
          <VInput label="Dirección exacta (solo para aprobados)" value={f.address_exact} onChangeText={v=>set("address_exact",v)} placeholder="Ej: Av. del Libertador 5200" />
          <View style={{ flexDirection:"row", gap:12 }}>
            <View style={{ flex:1 }}><VInput label="Fecha * (YYYY-MM-DD)" value={f.date} onChangeText={v=>set("date",v)} placeholder="2026-04-01" keyboardType="numeric" /></View>
            <View style={{ flex:1 }}><VInput label="Hora * (HH:MM)" value={f.time} onChangeText={v=>set("time",v)} placeholder="19:00" keyboardType="numeric" /></View>
          </View>
          <View style={{ flexDirection:"row", gap:12 }}>
            <View style={{ flex:1 }}><VInput label="Máx. jugadores" value={f.max_players} onChangeText={v=>set("max_players",v)} keyboardType="numeric" placeholder="10" /></View>
            <View style={{ flex:1 }}>
              <Text style={u.lbl}>Nivel</Text>
              <TouchableOpacity style={u.input} onPress={() => set("skill_level", {todos:"principiante",principiante:"intermedio",intermedio:"avanzado",avanzado:"todos"}[f.skill_level])}>
                <Text style={{ color:C.white }}>{f.skill_level}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={{ flexDirection:"row", gap:10, marginBottom:16 }}>
            <TouchableOpacity style={[s.levelBtn, { flex:1 }, f.is_free&&s.levelBtnActive]} onPress={() => set("is_free",true)}>
              <Text style={[s.levelTxt, f.is_free&&{ color:C.orange }]}>Gratis</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.levelBtn, { flex:1 }, !f.is_free&&s.levelBtnActive]} onPress={() => set("is_free",false)}>
              <Text style={[s.levelTxt, !f.is_free&&{ color:C.orange }]}>Con precio</Text>
            </TouchableOpacity>
          </View>
          {!f.is_free && <VInput label="Precio ($)" value={f.price} onChangeText={v=>set("price",v)} keyboardType="numeric" placeholder="2500" />}
          {coords && <Text style={[u.muted, { marginBottom:12, fontSize:12 }]}>📡 Tu ubicación será usada como punto de referencia del evento</Text>}
          <OBtn title="PUBLICAR EVENTO ⚡" onPress={create} busy={busy} style={{ marginTop:8 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────
function Notifications({ notifs, onBack, onMarkRead }) {
  useEffect(() => { onMarkRead(); }, []);
  return (
    <SafeAreaView style={{ flex:1, backgroundColor:C.black }}>
      <StatusBar barStyle="light-content" backgroundColor={C.black} />
      <View style={{ flexDirection:"row", alignItems:"center", padding:20 }}>
        <TouchableOpacity onPress={onBack} style={{ width:40, height:40, justifyContent:"center" }}>
          <Text style={{ fontSize:22, color:C.white }}>←</Text>
        </TouchableOpacity>
        <Text style={[u.h1, { flex:1, textAlign:"center", fontSize:20 }]}>Notificaciones</Text>
      </View>
      {notifs.length === 0 ? (
        <View style={{ flex:1, alignItems:"center", justifyContent:"center" }}>
          <Text style={{ fontSize:48 }}>🔔</Text>
          <Text style={[u.muted, { marginTop:12 }]}>Sin notificaciones</Text>
        </View>
      ) : (
        <FlatList data={notifs} keyExtractor={i => i.id} contentContainerStyle={{ padding:20 }}
          renderItem={({ item }) => (
            <View style={[s.card, !item.read && { borderColor:C.orange }]}>
              <Text style={{ color:C.white, fontWeight:"700", fontSize:15, marginBottom:4 }}>{item.title}</Text>
              <Text style={[u.muted, { fontSize:13 }]}>{item.body}</Text>
              <Text style={[u.muted, { fontSize:11, marginTop:8 }]}>
                {new Date(item.created_at).toLocaleDateString("es-AR", { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" })}
              </Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────
export default function App() {
  const [splashDone, setSplashDone]   = useState(false);
  const [screen, setScreen]           = useState("home");
  const [activeEvent, setActiveEvent] = useState(null);
  const { session, profile, loading, signOut } = useAuth();
  const { coords } = useGeoLocation();
  const { notifs, unread, markRead }  = useNotifications(session?.user?.id);

  if (!splashDone) return <Splash onEnter={() => setSplashDone(true)} />;
  if (loading)     return <Loader text="Iniciando VitaliApp..." />;
  if (!session)    return <Auth />;

  if (screen==="event" && activeEvent) return (
    <EventDetail event={activeEvent} userId={session.user.id} onBack={() => setScreen("home")} />
  );
  if (screen==="create") return (
    <CreateEvent profile={profile} coords={coords} onBack={() => setScreen("home")} onDone={() => setScreen("home")} />
  );
  if (screen==="notifs") return (
    <Notifications notifs={notifs} onBack={() => setScreen("home")} onMarkRead={markRead} />
  );

  return (
    <Home
      profile={profile} onSignOut={signOut} unread={unread}
      onOpenEvent={ev => { setActiveEvent(ev); setScreen("event"); }}
      onCreateEvent={() => setScreen("create")}
      onOpenNotifs={() => setScreen("notifs")}
    />
  );
}

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const u = StyleSheet.create({
  muted:    { color:C.muted, fontSize:13 },
  secLabel: { fontSize:10, color:C.orange, fontWeight:"700", letterSpacing:3, textTransform:"uppercase" },
  lbl:      { fontSize:12, color:C.muted, marginBottom:6, fontWeight:"600" },
  h1:       { fontSize:26, color:C.white, fontWeight:"900", marginBottom:6 },
  input:    { backgroundColor:C.dark, borderRadius:C.radiusSm, borderWidth:1, borderColor:C.mid, color:C.white, padding:14, fontSize:15 },
  oBtn:     { backgroundColor:C.orange, borderRadius:C.radiusSm, paddingVertical:16, alignItems:"center", shadowColor:C.orange, shadowOffset:{width:0,height:8}, shadowOpacity:0.4, shadowRadius:16, elevation:10 },
  oBtnText: { fontSize:14, color:C.black, fontWeight:"800", letterSpacing:2 },
  chip:     { backgroundColor:C.dark, borderRadius:C.radiusSm, paddingHorizontal:14, paddingVertical:8, marginRight:8, borderWidth:1, borderColor:C.mid },
  chipActive:{ backgroundColor:C.orangeDim, borderColor:C.orange },
  chipTxt:  { fontSize:13, color:C.muted, fontWeight:"600" },
});

const s = StyleSheet.create({
  splash:       { flex:1, backgroundColor:C.black, alignItems:"center", justifyContent:"space-between", paddingVertical:60, paddingHorizontal:28 },
  splashGlow:   { position:"absolute", width:SW*1.2, height:SW*1.2, borderRadius:SW*0.6, backgroundColor:"#FF6B0015", top:-SW*0.5, alignSelf:"center" },
  logoMark:     { width:84, height:84, borderRadius:42, backgroundColor:C.orange, alignItems:"center", justifyContent:"center", marginBottom:20, shadowColor:C.orange, shadowOffset:{width:0,height:0}, shadowOpacity:0.9, shadowRadius:30, elevation:20 },
  logoWord:     { fontSize:32, color:C.white, fontWeight:"900", letterSpacing:4 },
  logoSub:      { fontSize:11, color:C.orange, fontWeight:"700", letterSpacing:3, marginTop:6 },
  splashHero:   { fontSize:Math.min(64, SW*0.14), color:C.white, fontWeight:"900", textAlign:"center", lineHeight:Math.min(64,SW*0.14)*0.95, letterSpacing:-1 },
  topBar:       { flexDirection:"row", justifyContent:"space-between", alignItems:"center", paddingHorizontal:20, paddingTop:16, paddingBottom:12 },
  topGreet:     { fontSize:18, color:C.white, fontWeight:"800" },
  topZona:      { fontSize:11, color:C.orange, marginTop:2, fontWeight:"600" },
  avatar:       { width:40, height:40, borderRadius:20, backgroundColor:C.orange, alignItems:"center", justifyContent:"center" },
  avatarTxt:    { fontSize:16, color:C.black, fontWeight:"900" },
  notifBadge:   { position:"absolute", top:-4, right:-4, backgroundColor:C.red, borderRadius:8, minWidth:16, height:16, alignItems:"center", justifyContent:"center", paddingHorizontal:2 },
  statsRow:     { flexDirection:"row", backgroundColor:C.dark, marginHorizontal:20, borderRadius:C.radiusMd, padding:14, marginBottom:4 },
  sportChip:    { flexDirection:"row", alignItems:"center", backgroundColor:C.dark, borderRadius:C.radiusSm, paddingHorizontal:14, paddingVertical:10, marginRight:10, borderWidth:1, borderColor:C.mid },
  sportChipActive:{ backgroundColor:C.orangeDim, borderColor:C.orange },
  sportChipIcon:{ fontSize:18, marginRight:6 },
  sportChipLbl: { fontSize:13, color:C.muted, fontWeight:"700" },
  badge:        { marginLeft:8, backgroundColor:C.mid, borderRadius:10, paddingHorizontal:6, paddingVertical:1 },
  card:         { backgroundColor:"#111111", borderRadius:C.radiusMd, marginHorizontal:20, marginBottom:12, padding:16, borderWidth:1, borderColor:C.mid },
  cardTitle:    { fontSize:15, color:C.white, fontWeight:"800" },
  cardDate:     { fontSize:12, color:C.orange, marginTop:3, fontWeight:"700" },
  typeBadge:    { backgroundColor:C.orangeDim, borderRadius:6, paddingHorizontal:8, paddingVertical:3 },
  typeBadgeTxt: { fontSize:10, color:C.orange, fontWeight:"700" },
  pill:         { backgroundColor:C.mid, borderRadius:6, paddingHorizontal:8, paddingVertical:4 },
  pillTxt:      { fontSize:11, color:C.muted },
  miniAvatar:   { width:26, height:26, borderRadius:13, backgroundColor:C.orange, alignItems:"center", justifyContent:"center" },
  slotBadge:    { backgroundColor:C.mid, borderRadius:6, paddingHorizontal:10, paddingVertical:5 },
  slotTxt:      { fontSize:12, color:C.muted, fontWeight:"700" },
  fab:          { position:"absolute", bottom:24, left:20, right:20, backgroundColor:C.orange, borderRadius:C.radiusMd, paddingVertical:16, alignItems:"center", shadowColor:C.orange, shadowOffset:{width:0,height:8}, shadowOpacity:0.5, shadowRadius:20, elevation:12 },
  fabTxt:       { color:C.black, fontSize:15, fontWeight:"800", letterSpacing:1.5 },
  infoCell:     { flex:1, minWidth:(SW-60)/2, backgroundColor:"#111111", borderRadius:C.radiusSm, padding:14, borderWidth:1, borderColor:C.mid },
  detailCTA:    { position:"absolute", bottom:0, left:0, right:0, backgroundColor:"#111111", padding:20, paddingBottom:32, borderTopWidth:1, borderColor:C.mid },
  statusBanner: { backgroundColor:C.orangeDim, borderRadius:C.radiusSm, padding:14, borderWidth:1, borderColor:C.orange },
  statusBannerTxt:{ color:C.orange, fontWeight:"700", textAlign:"center" },
  actionBtn:    { width:36, height:36, borderRadius:8, alignItems:"center", justifyContent:"center" },
  sportGridItem:{ width:(SW-68)/3, backgroundColor:C.dark, borderRadius:C.radiusSm, padding:12, alignItems:"center", borderWidth:1, borderColor:C.mid },
  sportGridItemActive:{ backgroundColor:C.orangeDim, borderColor:C.orange },
  levelBtn:     { flex:1, backgroundColor:C.dark, borderRadius:C.radiusSm, paddingVertical:10, alignItems:"center", borderWidth:1, borderColor:C.mid },
  levelBtnActive:{ backgroundColor:C.orangeDim, borderColor:C.orange },
  levelTxt:     { fontSize:12, color:C.muted, fontWeight:"700" },
});
