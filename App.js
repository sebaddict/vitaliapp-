// ============================================================
// VITALIAPP — App.js v5.0 SPRINT 4
// ✅ Tab bar: Inicio · Explorar · Crear · Perfil · Avisos
// ✅ Perfil completo: historial, logros, stats, ranking
// ✅ Chat grupal realtime por evento
// ✅ Matching: invitar jugadores a partidos
// ✅ Solicitud centro deportivo con verificación
// ✅ Explorar jugadores y centros
// ✅ Geolocalización + radio configurable
// ✅ Supabase: vitaliapp-prod
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

const SB_URL = "https://qjutbnewvkhdjmjdiges.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqdXRibmV3dmtoZGptamRpZ2VzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMjMxODAsImV4cCI6MjA4OTY5OTE4MH0.CjQa5BLBrXjEP-oIhHNPbeE20l72v2Dz30SqWJdmpV8";
const FN = `${SB_URL}/functions/v1`;

// Usa WebSocket nativo de React Native — evita el módulo 'ws' de Node.js
// Esto resuelve los errores de net/tls/stream en el bundler
const supabase = createClient(SB_URL, SB_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  realtime: {
    transport: WebSocket,
    params: { eventsPerSecond: 10 },
  },
});

const C = {
  orange:"#FF6B00", orange2:"#FF8C33", orangeDim:"#FF6B0018",
  black:"#000000", dark:"#1A1A1A", mid:"#333333",
  white:"#FFFFFF", muted:"#888888",
  green:"#00C2A8", greenDim:"#00C2A810",
  red:"#FF4040", redDim:"#FF404010",
  blue:"#4A9EFF",
  radiusSm:8, radiusMd:12,
};
const { width: SW } = Dimensions.get("window");

const SPORT_ICONS  = { futbol:"⚽",basquet:"🏀",tenis:"🎾",padel:"🏓",running:"🏃",ciclismo:"🚴",yoga:"🧘",natacion:"🏊",voley:"🏐",otro:"🏅" };
const SPORT_LABELS = { futbol:"Fútbol",basquet:"Básquet",tenis:"Tenis",padel:"Padel",running:"Running",ciclismo:"Ciclismo",yoga:"Yoga",natacion:"Natación",voley:"Voley",otro:"Otro" };
const ZONA_LABELS  = { tigre:"Tigre",nordelta:"Nordelta",pilar:"Pilar",san_isidro:"San Isidro",san_fernando:"San Fernando",vicente_lopez:"Vicente López",olivos:"Olivos",martinez:"Martínez",acassuso:"Acassuso",beccar:"Beccar",general_pacheco:"Gral. Pacheco",otro:"Otra zona" };

// ── HOOKS ────────────────────────────────────
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

function useGeo() {
  const [coords, setCoords] = useState(null);
  const [ready, setReady]   = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        } else setCoords({ latitude: -34.4261, longitude: -58.5795 });
      } catch { setCoords({ latitude: -34.4261, longitude: -58.5795 }); }
      setReady(true);
    })();
  }, []);
  return { coords, ready };
}

function useFeed(coords, sport, radius) {
  const [events, setEvents]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fetch = useCallback(async (quiet = false) => {
    if (!coords) return;
    quiet ? setRefreshing(true) : setLoading(true);
    try {
      const p = new URLSearchParams({ lat: coords.latitude.toString(), lng: coords.longitude.toString(), radius: radius.toString(), ...(sport ? { sport } : {}) });
      const res = await global.fetch(`${FN}/nearby-events?${p}`, { headers: { apikey: SB_KEY } });
      const d = await res.json();
      if (d.events) setEvents(d.events);
    } catch {
      let q = supabase.from("feed_events").select("*").order("starts_at").limit(30);
      if (sport) q = q.eq("sport", sport);
      const { data } = await q;
      if (data) setEvents(data);
    }
    setLoading(false); setRefreshing(false);
  }, [coords, sport, radius]);
  useEffect(() => { if (coords) fetch(); }, [fetch]);
  return { events, loading, refreshing, refetch: () => fetch(true) };
}

function useNotifs(userId) {
  const [notifs, setNotifs] = useState([]);
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      const { data } = await supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
      if (data) { setNotifs(data); setUnread(data.filter(n => !n.read).length); }
    };
    load();
    const ch = supabase.channel("n-" + userId)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (p) => { setNotifs(prev => [p.new, ...prev]); setUnread(u => u + 1); }
      ).subscribe();
    return () => supabase.removeChannel(ch);
  }, [userId]);
  const markRead = async () => {
    await supabase.from("notifications").update({ read: true }).eq("user_id", userId);
    setUnread(0); setNotifs(p => p.map(n => ({ ...n, read: true })));
  };
  return { notifs, unread, markRead };
}

function useChat(eventId) {
  const [msgs, setMsgs] = useState([]);
  useEffect(() => {
    if (!eventId) return;
    supabase.from("event_chat").select("*, profiles(full_name,avatar_url)").eq("event_id", eventId).order("created_at").limit(100)
      .then(({ data }) => setMsgs(data || []));
    const ch = supabase.channel("chat-" + eventId)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "event_chat", filter: `event_id=eq.${eventId}` },
        async (p) => {
          const { data } = await supabase.from("event_chat").select("*, profiles(full_name,avatar_url)").eq("id", p.new.id).single();
          if (data) setMsgs(prev => [...prev, data]);
        }
      ).subscribe();
    return () => supabase.removeChannel(ch);
  }, [eventId]);
  return msgs;
}

// ── UI ATOMS ─────────────────────────────────
const Loader = ({ text = "Cargando..." }) => (
  <View style={{ flex:1, alignItems:"center", justifyContent:"center", backgroundColor:C.black }}>
    <ActivityIndicator size="large" color={C.orange} />
    <Text style={[u.muted, { marginTop:12 }]}>{text}</Text>
  </View>
);

const VInput = ({ label, style, ...props }) => (
  <View style={{ marginBottom:16 }}>
    {label && <Text style={u.lbl}>{label}</Text>}
    <TextInput style={[u.input, style]} placeholderTextColor={C.muted} {...props} />
  </View>
);

const OBtn = ({ title, onPress, busy, style, small, ghost }) => (
  <TouchableOpacity style={[ghost ? u.ghostBtn : u.oBtn, small && { paddingVertical:8, paddingHorizontal:14 }, style]} onPress={onPress} activeOpacity={0.85} disabled={busy}>
    {busy ? <ActivityIndicator color={ghost ? C.orange : C.black} size="small" />
          : <Text style={[ghost ? u.ghostBtnTxt : u.oBtnTxt, small && { fontSize:12 }]}>{title}</Text>}
  </TouchableOpacity>
);

const Chip = ({ label, active, onPress }) => (
  <TouchableOpacity style={[u.chip, active && u.chipOn]} onPress={onPress}>
    <Text style={[u.chipTxt, active && { color:C.orange }]}>{label}</Text>
  </TouchableOpacity>
);

const Ava = ({ name, url, size = 40 }) => (
  <View style={{ width:size, height:size, borderRadius:size/2, backgroundColor:C.orange, alignItems:"center", justifyContent:"center", overflow:"hidden" }}>
    {url ? <Image source={{ uri:url }} style={{ width:size, height:size }} />
         : <Text style={{ color:C.black, fontWeight:"900", fontSize:size*0.4 }}>{(name||"V")[0].toUpperCase()}</Text>}
  </View>
);

// ── SPLASH ───────────────────────────────────
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

// ── AUTH ──────────────────────────────────────
function Auth() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [pass, setPass]   = useState("");
  const [name, setName]   = useState("");
  const [busy, setBusy]   = useState(false);
  const [zona, setZona]   = useState(null);
  const [sports, setSports] = useState([]);
  const [level, setLevel] = useState(null);

  const login = async () => {
    if (!email||!pass) return Alert.alert("Completá email y contraseña");
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password:pass });
    if (error) Alert.alert("Error", error.message);
    setBusy(false);
  };
  const register = async () => {
    if (!email||!pass||!name) return Alert.alert("Completá todos los campos");
    setBusy(true);
    const { error } = await supabase.auth.signUp({ email, password:pass, options:{ data:{ full_name:name } } });
    if (error) Alert.alert("Error", error.message);
    else setMode("onboarding");
    setBusy(false);
  };
  const saveProfile = async () => {
    if (!zona||sports.length===0||!level) return Alert.alert("Completá tu perfil deportivo");
    setBusy(true);
    const { data:{ session } } = await supabase.auth.getSession();
    await supabase.from("profiles").update({ zona, sports, skill_level:level, onboarding_done:true }).eq("id", session.user.id);
    setBusy(false);
  };

  if (mode==="onboarding") return (
    <SafeAreaView style={{ flex:1, backgroundColor:C.black }}>
      <ScrollView contentContainerStyle={{ padding:24, paddingTop:40 }}>
        <Text style={u.h1}>Tu perfil ⚡</Text>
        <Text style={[u.muted, { marginBottom:24 }]}>Así te mostramos los eventos correctos</Text>
        <Text style={u.lbl}>¿Dónde jugás?</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:20 }}>
          {Object.entries(ZONA_LABELS).map(([k,v]) => <Chip key={k} label={v} active={zona===k} onPress={() => setZona(k)} />)}
          <View style={{ width:16 }} />
        </ScrollView>
        <Text style={u.lbl}>¿Qué deportes?</Text>
        <View style={{ flexDirection:"row", flexWrap:"wrap", gap:10, marginBottom:20 }}>
          {Object.entries(SPORT_ICONS).map(([k,icon]) => (
            <TouchableOpacity key={k} style={[s.sgItem, sports.includes(k)&&s.sgItemOn]} onPress={() => setSports(p => p.includes(k)?p.filter(x=>x!==k):[...p,k])}>
              <Text style={{ fontSize:24 }}>{icon}</Text>
              <Text style={[u.muted, { fontSize:11, marginTop:4 }, sports.includes(k)&&{ color:C.orange }]}>{SPORT_LABELS[k]}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={u.lbl}>Nivel</Text>
        <View style={{ flexDirection:"row", gap:10, marginBottom:32 }}>
          {["principiante","intermedio","avanzado"].map(l => (
            <TouchableOpacity key={l} style={[s.lvlBtn, level===l&&s.lvlBtnOn]} onPress={() => setLevel(l)}>
              <Text style={[s.lvlTxt, level===l&&{ color:C.orange }]}>{l.charAt(0).toUpperCase()+l.slice(1)}</Text>
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
          <VInput label="Contraseña" value={pass} onChangeText={setPass} placeholder="••••••••" secureTextEntry />
          <OBtn title={mode==="login"?"INGRESAR →":"CREAR CUENTA →"} onPress={mode==="login"?login:register} busy={busy} style={{ marginTop:8 }} />
          <TouchableOpacity onPress={() => setMode(mode==="login"?"register":"login")} style={{ marginTop:20, alignItems:"center" }}>
            <Text style={u.muted}>{mode==="login"?"¿No tenés cuenta? Registrate":"¿Ya tenés cuenta? Ingresá"}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

// ── TAB BAR ──────────────────────────────────
const TabBar = ({ active, onChange, unread }) => {
  const tabs = [
    { k:"home",    i:"🏟", l:"Inicio" },
    { k:"explore", i:"🔍", l:"Explorar" },
    { k:"create",  i:"⚡", l:"Crear" },
    { k:"profile", i:"👤", l:"Perfil" },
    { k:"notifs",  i:"🔔", l:"Avisos", badge:unread },
  ];
  return (
    <View style={s.tabBar}>
      {tabs.map(t => (
        <TouchableOpacity key={t.k} style={s.tabItem} onPress={() => onChange(t.k)}>
          <View style={{ position:"relative" }}>
            <Text style={{ fontSize:t.k==="create"?26:22 }}>{t.i}</Text>
            {t.badge>0 && <View style={s.tabBadge}><Text style={{ color:C.white, fontSize:9, fontWeight:"800" }}>{t.badge}</Text></View>}
          </View>
          <Text style={[s.tabLbl, active===t.k&&{ color:C.orange }]}>{t.l}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

// ── HOME ─────────────────────────────────────
function Home({ profile, onOpenEvent }) {
  const [sport, setSport]   = useState(null);
  const [radius, setRadius] = useState(30);
  const { coords, ready }   = useGeo();
  const { events, loading, refreshing, refetch } = useFeed(coords, sport, radius);

  return (
    <View style={{ flex:1 }}>
      <View style={s.topBar}>
        <View>
          <Text style={s.topGreet}>Hola, {profile?.full_name?.split(" ")[0]||"atleta"} 👋</Text>
          <Text style={s.topZona}>{ready?"📡 Ubicación activa · ":"📍 "}{events.length} eventos</Text>
        </View>
        <Ava name={profile?.full_name} url={profile?.avatar_url} size={40} />
      </View>
      <View style={s.statsRow}>
        <View style={{ flex:1, alignItems:"center" }}>
          <Text style={{ color:C.orange, fontWeight:"900", fontSize:20 }}>{events.length}</Text>
          <Text style={[u.muted, { fontSize:10, fontWeight:"700" }]}>EVENTOS</Text>
        </View>
        <View style={{ width:1, backgroundColor:C.mid }} />
        <View style={{ flex:1, alignItems:"center" }}>
          <Text style={{ color:C.orange, fontWeight:"900", fontSize:20 }}>{events[0]?.distance_km?`${events[0].distance_km}km`:"—"}</Text>
          <Text style={[u.muted, { fontSize:10, fontWeight:"700" }]}>MÁS CERCA</Text>
        </View>
        <View style={{ width:1, backgroundColor:C.mid }} />
        <View style={{ flex:1, alignItems:"center" }}>
          <Text style={{ color:C.orange, fontWeight:"900", fontSize:20 }}>{profile?.points||0}</Text>
          <Text style={[u.muted, { fontSize:10, fontWeight:"700" }]}>PUNTOS</Text>
        </View>
      </View>
      <View style={{ flexDirection:"row", gap:8, paddingHorizontal:20, marginTop:10 }}>
        {[10,20,30,50].map(r => (
          <TouchableOpacity key={r}
            style={{ backgroundColor:radius===r?C.orange:C.dark, borderRadius:C.radiusSm, paddingHorizontal:14, paddingVertical:6, borderWidth:1, borderColor:radius===r?C.orange:C.mid }}
            onPress={() => setRadius(r)}>
            <Text style={{ color:radius===r?C.black:C.muted, fontSize:12, fontWeight:"700" }}>{r}km</Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom:20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={C.orange} />}>
        <View style={{ paddingHorizontal:20, marginTop:16 }}>
          <Text style={u.secLbl}>DEPORTES</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop:10 }}>
            <TouchableOpacity style={[s.sportChip, !sport&&s.sportChipOn]} onPress={() => setSport(null)}>
              <Text style={s.sportChipI}>🏟</Text>
              <Text style={[s.sportChipL, !sport&&{ color:C.orange }]}>Todos</Text>
            </TouchableOpacity>
            {Object.keys(SPORT_ICONS).map(k => {
              const on = sport===k;
              const cnt = events.filter(e => e.sport===k).length;
              if (!on&&cnt===0) return null;
              return (
                <TouchableOpacity key={k} style={[s.sportChip, on&&s.sportChipOn]} onPress={() => setSport(on?null:k)}>
                  <Text style={s.sportChipI}>{SPORT_ICONS[k]}</Text>
                  <Text style={[s.sportChipL, on&&{ color:C.orange }]}>{SPORT_LABELS[k]}</Text>
                  <View style={[s.badge, on&&{ backgroundColor:C.orange }]}>
                    <Text style={[{ fontSize:10, color:C.muted, fontWeight:"700" }, on&&{ color:C.black }]}>{cnt}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            <View style={{ width:16 }} />
          </ScrollView>
        </View>
        <View style={{ flexDirection:"row", justifyContent:"space-between", alignItems:"center", paddingHorizontal:20, marginTop:20, marginBottom:12 }}>
          <Text style={u.secLbl}>CERCA TUYO AHORA</Text>
          <Text style={u.muted}>{events.length} eventos</Text>
        </View>
        {loading ? <Loader text="Buscando eventos..." />
          : events.length===0 ? (
            <View style={{ alignItems:"center", paddingVertical:40 }}>
              <Text style={{ fontSize:48, marginBottom:12 }}>{sport?SPORT_ICONS[sport]:"🏟"}</Text>
              <Text style={u.muted}>Sin eventos en {radius}km</Text>
            </View>
          ) : events.map(ev => <EventCard key={ev.id} event={ev} onPress={() => onOpenEvent(ev)} />)
        }
      </ScrollView>
    </View>
  );
}

// ── EVENT CARD ────────────────────────────────
function EventCard({ event, onPress }) {
  const slots=event.slots_available; const urgent=slots<=2&&slots>0; const full=slots<=0;
  const date = new Date(event.starts_at).toLocaleDateString("es-AR", { weekday:"short",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit" });
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
          <View style={s.typeBadge}><Text style={s.typeBadgeTxt}>{event.event_type==="partido"?"PARTIDO":event.event_type==="clase"?"CLASE":"CANCHA"}</Text></View>
          {event.distance_km!==undefined && <View style={{ backgroundColor:C.orangeDim, borderRadius:6, paddingHorizontal:8, paddingVertical:3 }}><Text style={{ fontSize:11, color:C.orange, fontWeight:"700" }}>📍 {event.distance_km}km</Text></View>}
        </View>
      </View>
      <View style={{ flexDirection:"row", flexWrap:"wrap", marginTop:12, gap:6 }}>
        <View style={s.pill}><Text style={s.pillTxt}>📍 {event.address_public}</Text></View>
        <View style={s.pill}><Text style={s.pillTxt}>🏅 {event.skill_level}</Text></View>
        <View style={[s.pill, event.is_free&&{ backgroundColor:"#00C2A815" }]}>
          <Text style={[s.pillTxt, event.is_free&&{ color:C.green }]}>💰 {event.is_free?"Gratis":`$${Number(event.price).toLocaleString("es-AR")}`}</Text>
        </View>
      </View>
      <View style={{ flexDirection:"row", justifyContent:"space-between", alignItems:"center", marginTop:14 }}>
        <View style={{ flexDirection:"row", alignItems:"center" }}>
          <Ava name={event.organizer_name} url={event.organizer_avatar} size={26} />
          <Text style={[u.muted, { fontSize:11, marginLeft:6 }]}>{event.organizer_name}</Text>
          {event.organizer_verified&&<Text style={{ marginLeft:4, fontSize:11, color:C.orange }}>✓</Text>}
        </View>
        <View style={[s.slotBadge, urgent&&{ backgroundColor:"#FF6B0018" }, full&&{ backgroundColor:C.redDim }]}>
          <Text style={[s.slotTxt, urgent&&{ color:C.orange }, full&&{ color:C.red }]}>
            {full?"COMPLETO":urgent?`⚠ ${slots} lugar${slots>1?"es":""}`:` ${slots} lugares`}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── EVENT DETAIL ──────────────────────────────
function EventDetail({ event, userId, session, onBack }) {
  const [tab, setTab]         = useState("info");
  const [myStatus, setMyStatus] = useState(null);
  const [message, setMessage] = useState("");
  const [chatMsg, setChatMsg] = useState("");
  const [busy, setBusy]       = useState(false);
  const [checking, setChecking] = useState(true);
  const [participants, setParticipants] = useState([]);
  const chatMessages = useChat(tab==="chat" ? event.id : null);
  const isOrg = event.organizer_id===userId;
  const canChat = isOrg || myStatus==="aprobado";

  useEffect(() => { checkStatus(); loadParticipants(); }, []);

  const checkStatus = async () => {
    const { data } = await supabase.from("event_participants").select("status").eq("event_id",event.id).eq("user_id",userId).single();
    setMyStatus(data?.status||null); setChecking(false);
  };
  const loadParticipants = async () => {
    const { data } = await supabase.from("event_participants").select("*, profiles(id,full_name,avatar_url,skill_level,zona,rating)").eq("event_id",event.id).order("joined_at");
    setParticipants(data||[]);
  };
  const requestJoin = async () => {
    setBusy(true);
    const { error } = await supabase.from("event_participants").insert({ event_id:event.id, user_id:userId, message });
    if (error) Alert.alert("Error", error.message);
    else setMyStatus("pendiente");
    setBusy(false);
  };
  const sendChat = async () => {
    if (!chatMsg.trim()) return;
    setBusy(true);
    await global.fetch(`${FN}/event-social?action=send`, {
      method:"POST",
      headers:{ "Content-Type":"application/json", Authorization:`Bearer ${session?.access_token}`, apikey:SB_KEY },
      body:JSON.stringify({ event_id:event.id, message:chatMsg }),
    });
    setChatMsg(""); setBusy(false);
  };
  const invitePlayer = async (toId, toName) => {
    const res = await global.fetch(`${FN}/event-social?action=invite`, {
      method:"POST",
      headers:{ "Content-Type":"application/json", Authorization:`Bearer ${session?.access_token}`, apikey:SB_KEY },
      body:JSON.stringify({ event_id:event.id, to_user:toId }),
    });
    const d = await res.json();
    if (d.success) Alert.alert("✅ Invitación enviada", `Invitaste a ${toName}`);
    else Alert.alert("Error", d.error);
  };
  const approve = async (id) => { await supabase.from("event_participants").update({ status:"aprobado" }).eq("id",id); loadParticipants(); };
  const reject  = async (id) => { await supabase.from("event_participants").update({ status:"rechazado" }).eq("id",id); loadParticipants(); };

  const dateStr = new Date(event.starts_at).toLocaleDateString("es-AR", { weekday:"long",year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit" });

  return (
    <SafeAreaView style={{ flex:1, backgroundColor:C.black }}>
      <StatusBar barStyle="light-content" backgroundColor={C.black} />
      <View style={{ flexDirection:"row", justifyContent:"space-between", alignItems:"center", padding:16 }}>
        <TouchableOpacity onPress={onBack} style={{ width:40, height:40, justifyContent:"center" }}>
          <Text style={{ fontSize:22, color:C.white }}>←</Text>
        </TouchableOpacity>
        <Text style={{ color:C.orange, fontSize:11, fontWeight:"700", letterSpacing:2 }}>{event.event_type?.toUpperCase()}{event.distance_km?` · ${event.distance_km}km`:""}</Text>
        <View style={{ width:40 }} />
      </View>
      <View style={{ flexDirection:"row", paddingHorizontal:20, gap:8, marginBottom:12 }}>
        {[["info","ℹ️ Info"],["chat","💬 Chat"],["players","👥 Equipo"]].map(([k,l]) => (
          <TouchableOpacity key={k} style={[{ flex:1, paddingVertical:8, borderRadius:C.radiusSm, alignItems:"center", backgroundColor:tab===k?C.orange:C.dark, borderWidth:1, borderColor:tab===k?C.orange:C.mid }]} onPress={() => setTab(k)}>
            <Text style={{ fontSize:12, fontWeight:"700", color:tab===k?C.black:C.muted }}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab==="info" && (
        <ScrollView contentContainerStyle={{ paddingBottom:180 }}>
          <View style={{ alignItems:"center", paddingVertical:16, paddingHorizontal:20 }}>
            <Text style={{ fontSize:52, marginBottom:10 }}>{SPORT_ICONS[event.sport]}</Text>
            <Text style={[u.h1, { textAlign:"center", fontSize:22 }]}>{event.title}</Text>
            <Text style={{ color:C.orange, fontWeight:"700", marginTop:6, textAlign:"center", fontSize:12 }}>{dateStr}</Text>
          </View>
          <View style={{ flexDirection:"row", flexWrap:"wrap", gap:10, paddingHorizontal:20 }}>
            <View style={[s.infoCell]}><Text style={{ fontSize:20 }}>📍</Text><Text style={[u.muted,{fontSize:11,marginTop:4}]}>Zona</Text><Text style={{ color:C.white, fontSize:13, fontWeight:"700", marginTop:2 }}>{event.address_public}</Text></View>
            {myStatus==="aprobado"&&event.address_exact&&<View style={[s.infoCell,{borderColor:C.orange}]}><Text style={{ fontSize:20 }}>🗺</Text><Text style={[u.muted,{fontSize:11,marginTop:4}]}>Dirección exacta</Text><Text style={{ color:C.orange, fontSize:13, fontWeight:"700", marginTop:2 }}>{event.address_exact}</Text></View>}
            <View style={s.infoCell}><Text style={{ fontSize:20 }}>🏅</Text><Text style={[u.muted,{fontSize:11,marginTop:4}]}>Nivel</Text><Text style={{ color:C.white, fontSize:13, fontWeight:"700", marginTop:2 }}>{event.skill_level}</Text></View>
            <View style={s.infoCell}><Text style={{ fontSize:20 }}>👥</Text><Text style={[u.muted,{fontSize:11,marginTop:4}]}>Jugadores</Text><Text style={{ color:C.white, fontSize:13, fontWeight:"700", marginTop:2 }}>{event.current_players}/{event.max_players}</Text></View>
            <View style={s.infoCell}><Text style={{ fontSize:20 }}>💰</Text><Text style={[u.muted,{fontSize:11,marginTop:4}]}>Precio</Text><Text style={{ color:C.white, fontSize:13, fontWeight:"700", marginTop:2 }}>{event.is_free?"Gratis":`$${Number(event.price).toLocaleString("es-AR")}`}</Text></View>
            {event.distance_km&&<View style={[s.infoCell,{borderColor:C.orange}]}><Text style={{ fontSize:20 }}>📡</Text><Text style={[u.muted,{fontSize:11,marginTop:4}]}>Distancia</Text><Text style={{ color:C.orange, fontSize:13, fontWeight:"700", marginTop:2 }}>{event.distance_km} km</Text></View>}
          </View>
          {event.description&&<View style={{ paddingHorizontal:20, marginTop:20 }}><Text style={u.secLbl}>DESCRIPCIÓN</Text><Text style={[u.muted,{marginTop:8,lineHeight:22}]}>{event.description}</Text></View>}
          {isOrg&&participants.filter(p=>p.status==="pendiente").length>0&&(
            <View style={{ paddingHorizontal:20, marginTop:20 }}>
              <Text style={u.secLbl}>SOLICITUDES ({participants.filter(p=>p.status==="pendiente").length})</Text>
              {participants.filter(p=>p.status==="pendiente").map(p => (
                <View key={p.id} style={{ flexDirection:"row", alignItems:"center", backgroundColor:C.dark, borderRadius:C.radiusSm, padding:12, marginTop:8 }}>
                  <Ava name={p.profiles?.full_name} url={p.profiles?.avatar_url} size={36} />
                  <View style={{ flex:1, marginLeft:10 }}>
                    <Text style={{ color:C.white, fontWeight:"700", fontSize:13 }}>{p.profiles?.full_name}</Text>
                    <Text style={u.muted}>{p.profiles?.skill_level}</Text>
                    {p.message&&<Text style={[u.muted,{fontSize:11,fontStyle:"italic"}]}>"{p.message}"</Text>}
                  </View>
                  <View style={{ flexDirection:"row", gap:8 }}>
                    <TouchableOpacity style={[s.actionBtn,{backgroundColor:C.greenDim}]} onPress={()=>approve(p.id)}><Text style={{ color:C.green, fontSize:18 }}>✓</Text></TouchableOpacity>
                    <TouchableOpacity style={[s.actionBtn,{backgroundColor:C.redDim}]} onPress={()=>reject(p.id)}><Text style={{ color:C.red, fontSize:18 }}>✕</Text></TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {tab==="chat" && (
        <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS==="ios"?"padding":undefined}>
          {!canChat ? (
            <View style={{ flex:1, alignItems:"center", justifyContent:"center" }}>
              <Text style={{ fontSize:40 }}>🔒</Text>
              <Text style={[u.muted,{marginTop:12,textAlign:"center"}]}>Necesitás ser aprobado para chatear</Text>
            </View>
          ) : (
            <>
              <FlatList data={chatMessages} keyExtractor={i=>i.id} contentContainerStyle={{ padding:16, gap:8 }}
                renderItem={({ item }) => {
                  const isMe = item.user_id===userId;
                  return (
                    <View style={{ alignItems:isMe?"flex-end":"flex-start" }}>
                      {!isMe&&<Text style={[u.muted,{fontSize:11,marginBottom:3,marginLeft:4}]}>{item.profiles?.full_name}</Text>}
                      <View style={{ backgroundColor:isMe?C.orange:C.dark, borderRadius:12, paddingHorizontal:14, paddingVertical:10, maxWidth:SW*0.72, borderBottomRightRadius:isMe?2:12, borderBottomLeftRadius:isMe?12:2 }}>
                        <Text style={{ color:isMe?C.black:C.white, fontSize:14 }}>{item.message}</Text>
                        <Text style={{ color:isMe?"rgba(0,0,0,0.5)":C.muted, fontSize:10, marginTop:4, textAlign:"right" }}>
                          {new Date(item.created_at).toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"})}
                        </Text>
                      </View>
                    </View>
                  );
                }}
              />
              <View style={{ flexDirection:"row", padding:12, gap:10, borderTopWidth:1, borderColor:C.mid }}>
                <TextInput style={[u.input,{flex:1}]} placeholder="Mensaje..." placeholderTextColor={C.muted} value={chatMsg} onChangeText={setChatMsg} multiline />
                <TouchableOpacity style={{ backgroundColor:C.orange, width:44, height:44, borderRadius:22, alignItems:"center", justifyContent:"center" }} onPress={sendChat} disabled={busy}>
                  <Text style={{ fontSize:20 }}>➤</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </KeyboardAvoidingView>
      )}

      {tab==="players" && (
        <ScrollView contentContainerStyle={{ padding:16, gap:8 }}>
          <Text style={[u.secLbl,{marginBottom:8}]}>APROBADOS ({participants.filter(p=>p.status==="aprobado").length})</Text>
          {participants.filter(p=>p.status==="aprobado").map(p => (
            <View key={p.id} style={[s.card,{flexDirection:"row",alignItems:"center",padding:12}]}>
              <Ava name={p.profiles?.full_name} url={p.profiles?.avatar_url} size={44} />
              <View style={{ flex:1, marginLeft:12 }}>
                <Text style={{ color:C.white, fontWeight:"700", fontSize:14 }}>{p.profiles?.full_name}</Text>
                <Text style={u.muted}>{ZONA_LABELS[p.profiles?.zona]||""} · {p.profiles?.skill_level}</Text>
                {p.profiles?.rating&&<Text style={{ color:C.orange, fontSize:12 }}>⭐ {Number(p.profiles.rating).toFixed(1)}</Text>}
              </View>
              {p.user_id!==userId&&(
                <TouchableOpacity style={{ backgroundColor:C.orangeDim, borderRadius:8, paddingHorizontal:12, paddingVertical:6 }} onPress={() => invitePlayer(p.user_id, p.profiles?.full_name)}>
                  <Text style={{ color:C.orange, fontSize:12, fontWeight:"700" }}>Invitar</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          {participants.filter(p=>p.status==="aprobado").length===0&&<View style={{ alignItems:"center", paddingVertical:32 }}><Text style={{ fontSize:40 }}>👥</Text><Text style={[u.muted,{marginTop:12}]}>Sin participantes aún</Text></View>}
        </ScrollView>
      )}

      {tab==="info"&&!isOrg&&!checking&&(
        <View style={s.detailCTA}>
          {(!myStatus||myStatus==="retirado")?(
            <>
              <TextInput style={[u.input,{marginBottom:12}]} placeholder="Mensaje al organizador (opcional)" placeholderTextColor={C.muted} value={message} onChangeText={setMessage} multiline />
              <OBtn title="SOLICITAR UNIRME →" onPress={requestJoin} busy={busy} />
            </>
          ):myStatus==="pendiente"?(
            <View style={s.statusBanner}><Text style={s.statusBannerTxt}>⏳ Esperando aprobación</Text></View>
          ):myStatus==="aprobado"?(
            <View style={[s.statusBanner,{backgroundColor:C.greenDim,borderColor:C.green}]}><Text style={[s.statusBannerTxt,{color:C.green}]}>✓ ¡Estás adentro! Dirección desbloqueada</Text></View>
          ):myStatus==="rechazado"?(
            <View style={[s.statusBanner,{backgroundColor:C.redDim,borderColor:C.red}]}><Text style={[s.statusBannerTxt,{color:C.red}]}>Solicitud rechazada</Text></View>
          ):null}
        </View>
      )}
    </SafeAreaView>
  );
}

// ── PERFIL ────────────────────────────────────
function ProfileScreen({ userId, currentUserId, session, onSignOut }) {
  const isMe = userId===currentUserId;
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [ef, setEf]         = useState({});
  const [tab, setTab]       = useState("history");

  useEffect(() => { loadData(); }, [userId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await global.fetch(`${FN}/user-profile?action=get&user_id=${userId}`, {
        headers:{ Authorization:`Bearer ${session?.access_token}`, apikey:SB_KEY },
      });
      const d = await res.json();
      setData(d);
      if (isMe) setEf({ full_name:d.profile?.full_name, bio:d.profile?.bio, instagram:d.profile?.instagram });
    } catch {
      const { data:p } = await supabase.from("profiles").select("*").eq("id",userId).single();
      setData({ profile:p, history:[], achievements:[], stats:null });
    }
    setLoading(false);
  };

  const saveEdit = async () => {
    const res = await global.fetch(`${FN}/user-profile?action=update`, {
      method:"POST", headers:{ "Content-Type":"application/json", Authorization:`Bearer ${session?.access_token}`, apikey:SB_KEY },
      body:JSON.stringify(ef),
    });
    const d = await res.json();
    if (d.success) { setEditing(false); loadData(); }
    else Alert.alert("Error al guardar");
  };

  if (loading) return <Loader text="Cargando perfil..." />;
  const p=data?.profile; const history=data?.history||[]; const achievements=data?.achievements||[]; const stats=data?.stats;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom:32 }}>
      <View style={{ backgroundColor:C.dark, height:110, position:"relative", marginBottom:52 }}>
        <View style={{ position:"absolute", bottom:-42, left:20 }}>
          <Ava name={p?.full_name} url={p?.avatar_url} size={84} />
        </View>
        <View style={{ position:"absolute", top:16, right:16, flexDirection:"row", gap:8 }}>
          {isMe&&<TouchableOpacity style={{ backgroundColor:C.orangeDim, borderRadius:8, paddingHorizontal:14, paddingVertical:6, borderWidth:1, borderColor:C.orange }} onPress={() => setEditing(!editing)}>
            <Text style={{ color:C.orange, fontSize:12, fontWeight:"700" }}>{editing?"Cancelar":"Editar"}</Text>
          </TouchableOpacity>}
          {isMe&&!editing&&<TouchableOpacity style={{ backgroundColor:C.redDim, borderRadius:8, paddingHorizontal:14, paddingVertical:6 }} onPress={onSignOut}>
            <Text style={{ color:C.red, fontSize:12, fontWeight:"700" }}>Salir</Text>
          </TouchableOpacity>}
        </View>
      </View>

      <View style={{ paddingHorizontal:20 }}>
        {editing?(
          <View>
            <VInput label="Nombre" value={ef.full_name||""} onChangeText={v=>setEf(f=>({...f,full_name:v}))} />
            <VInput label="Bio" value={ef.bio||""} onChangeText={v=>setEf(f=>({...f,bio:v}))} placeholder="Contá quién sos..." multiline />
            <VInput label="Instagram" value={ef.instagram||""} onChangeText={v=>setEf(f=>({...f,instagram:v}))} placeholder="@tuusuario" />
            <OBtn title="GUARDAR ✓" onPress={saveEdit} />
          </View>
        ):(
          <>
            <View style={{ flexDirection:"row", alignItems:"center", gap:8, marginBottom:4 }}>
              <Text style={{ color:C.white, fontSize:22, fontWeight:"900" }}>{p?.full_name}</Text>
              {p?.is_verified&&<Text style={{ color:C.orange, fontSize:16 }}>✓</Text>}
            </View>
            <Text style={[u.muted,{marginBottom:4}]}>@{p?.username||"usuario"}</Text>
            {p?.bio&&<Text style={[u.muted,{marginBottom:8}]}>{p.bio}</Text>}
            {p?.instagram&&<Text style={{ color:C.blue, marginBottom:12 }}>📸 {p.instagram}</Text>}
            <View style={{ flexDirection:"row", flexWrap:"wrap", gap:8, marginBottom:16 }}>
              {(p?.sports||[]).map(sp => (
                <View key={sp} style={{ backgroundColor:C.orangeDim, borderRadius:20, paddingHorizontal:12, paddingVertical:5, flexDirection:"row", alignItems:"center", gap:4 }}>
                  <Text style={{ fontSize:14 }}>{SPORT_ICONS[sp]||"🏅"}</Text>
                  <Text style={{ color:C.orange, fontSize:12, fontWeight:"700" }}>{SPORT_LABELS[sp]}</Text>
                </View>
              ))}
            </View>
            <View style={[s.statsRow,{marginHorizontal:0}]}>
              {[["Jugados",p?.events_joined||0],["Creados",p?.events_created||0],["Puntos",p?.points||0]].map(([l,v]) => (
                <View key={l} style={{ flex:1, alignItems:"center" }}>
                  <Text style={{ color:C.orange, fontWeight:"900", fontSize:20 }}>{v}</Text>
                  <Text style={[u.muted,{fontSize:10,fontWeight:"700"}]}>{l.toUpperCase()}</Text>
                </View>
              ))}
              {p?.rating&&<View style={{ flex:1, alignItems:"center" }}><Text style={{ color:C.orange, fontWeight:"900", fontSize:20 }}>⭐{Number(p.rating).toFixed(1)}</Text><Text style={[u.muted,{fontSize:10,fontWeight:"700"}]}>RATING</Text></View>}
            </View>
            {stats&&<View style={{ flexDirection:"row", gap:8, marginTop:10 }}>
              <View style={{ backgroundColor:C.dark, borderRadius:8, paddingHorizontal:12, paddingVertical:6, borderWidth:1, borderColor:C.mid }}><Text style={{ color:C.muted, fontSize:11 }}>🏆 #{stats.zona_rank} en {ZONA_LABELS[p?.zona]||"tu zona"}</Text></View>
              <View style={{ backgroundColor:C.dark, borderRadius:8, paddingHorizontal:12, paddingVertical:6, borderWidth:1, borderColor:C.mid }}><Text style={{ color:C.muted, fontSize:11 }}>🌎 #{stats.global_rank} global</Text></View>
            </View>}
          </>
        )}

        {!editing&&<>
          <View style={{ flexDirection:"row", gap:8, marginTop:24, marginBottom:16 }}>
            {[["history","📅 Historial"],["achievements","🏅 Logros"]].map(([k,l]) => (
              <TouchableOpacity key={k} style={[{flex:1,paddingVertical:8,borderRadius:C.radiusSm,alignItems:"center",backgroundColor:tab===k?C.orange:C.dark,borderWidth:1,borderColor:tab===k?C.orange:C.mid}]} onPress={()=>setTab(k)}>
                <Text style={{fontSize:12,fontWeight:"700",color:tab===k?C.black:C.muted}}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {tab==="history"&&(history.length===0?(
            <View style={{alignItems:"center",paddingVertical:32}}><Text style={{fontSize:40}}>📅</Text><Text style={[u.muted,{marginTop:12}]}>Sin historial aún</Text></View>
          ):history.map(h=>(
            <View key={h.event_id} style={[s.card,{padding:14,marginBottom:8}]}>
              <View style={{flexDirection:"row",alignItems:"center",gap:10}}>
                <Text style={{fontSize:24}}>{SPORT_ICONS[h.sport]||"🏅"}</Text>
                <View style={{flex:1}}>
                  <Text style={{color:C.white,fontWeight:"700",fontSize:14}} numberOfLines={1}>{h.title}</Text>
                  <Text style={u.muted}>{ZONA_LABELS[h.zona]||h.zona} · {new Date(h.starts_at).toLocaleDateString("es-AR")}</Text>
                </View>
                <View style={{backgroundColor:h.participation_status==="aprobado"?C.greenDim:C.orangeDim,borderRadius:6,paddingHorizontal:8,paddingVertical:3}}>
                  <Text style={{fontSize:11,color:h.participation_status==="aprobado"?C.green:C.orange,fontWeight:"700"}}>{h.participation_status.toUpperCase()}</Text>
                </View>
              </View>
            </View>
          )))}
          {tab==="achievements"&&(achievements.length===0?(
            <View style={{alignItems:"center",paddingVertical:32}}><Text style={{fontSize:40}}>🏅</Text><Text style={[u.muted,{marginTop:12}]}>Jugá para ganar logros</Text></View>
          ):achievements.map(a=>(
            <View key={a.id} style={[s.card,{flexDirection:"row",alignItems:"center",gap:12,padding:14}]}>
              <Text style={{fontSize:32}}>{a.achievements?.icon||"🏅"}</Text>
              <View style={{flex:1}}><Text style={{color:C.white,fontWeight:"700"}}>{a.achievements?.name}</Text><Text style={u.muted}>{a.achievements?.description}</Text></View>
              <Text style={{color:C.orange,fontWeight:"800"}}>+{a.achievements?.points_value}</Text>
            </View>
          )))}
        </>}
      </View>
    </ScrollView>
  );
}

// ── CREATE EVENT ──────────────────────────────
function CreateEvent({ profile, coords, onDone, onRequestCenter }) {
  const [f, setF] = useState({ event_type:"partido",sport:"futbol",title:"",description:"",skill_level:"todos",zona:profile?.zona||"tigre",address_public:"",address_exact:"",max_players:"10",is_free:true,price:"0",date:"",time:"" });
  const [busy, setBusy] = useState(false);
  const set = (k,v) => setF(p=>({...p,[k]:v}));

  const create = async () => {
    if (!f.title||!f.address_public||!f.date||!f.time) return Alert.alert("Completá los campos obligatorios");
    setBusy(true);
    const { data:{ session } } = await supabase.auth.getSession();
    const { error } = await supabase.from("events").insert({
      organizer_id:session.user.id, event_type:f.event_type, sport:f.sport, title:f.title,
      description:f.description, skill_level:f.skill_level, zona:f.zona,
      address_public:f.address_public, address_exact:f.address_exact,
      max_players:parseInt(f.max_players)||10, is_free:f.is_free, price:f.is_free?0:parseFloat(f.price)||0,
      starts_at:new Date(`${f.date}T${f.time}:00`).toISOString(),
      lat:coords?.latitude||null, lng:coords?.longitude||null,
    });
    if (error) Alert.alert("Error", error.message);
    else { Alert.alert("¡Evento publicado! ⚡"); onDone(); }
    setBusy(false);
  };

  return (
    <ScrollView contentContainerStyle={{ padding:20, paddingBottom:60 }}>
      {/* Centro deportivo banner */}
      <TouchableOpacity onPress={onRequestCenter} style={{ flexDirection:"row", alignItems:"center", gap:10, backgroundColor:C.dark, borderRadius:C.radiusMd, padding:16, borderWidth:1, borderColor:C.mid, marginBottom:24 }}>
        <Text style={{ fontSize:28 }}>🏟</Text>
        <View style={{ flex:1 }}>
          <Text style={{ color:C.white, fontWeight:"700" }}>¿Tenés un centro deportivo?</Text>
          <Text style={u.muted}>Solicitá la verificación oficial →</Text>
        </View>
        <Text style={{ color:C.orange, fontSize:20 }}>›</Text>
      </TouchableOpacity>

      <Text style={u.h1}>Crear evento</Text>
      <Text style={u.lbl}>Tipo</Text>
      <View style={{ flexDirection:"row", gap:10, marginBottom:20 }}>
        {[["partido","⚽ Partido"],["clase","🧘 Clase"],["cancha","🏟 Cancha"]].map(([k,l]) => (
          <TouchableOpacity key={k} style={[s.lvlBtn,{flex:1},f.event_type===k&&s.lvlBtnOn]} onPress={() => set("event_type",k)}>
            <Text style={[s.lvlTxt,f.event_type===k&&{color:C.orange}]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={u.lbl}>Deporte</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:16 }}>
        {Object.entries(SPORT_ICONS).map(([k,icon]) => (
          <TouchableOpacity key={k} style={[s.sportChip,f.sport===k&&s.sportChipOn]} onPress={() => set("sport",k)}>
            <Text style={s.sportChipI}>{icon}</Text>
            <Text style={[s.sportChipL,f.sport===k&&{color:C.orange}]}>{SPORT_LABELS[k]}</Text>
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
      <VInput label="Dirección exacta (solo aprobados)" value={f.address_exact} onChangeText={v=>set("address_exact",v)} placeholder="Av. del Libertador 5200" />
      <View style={{ flexDirection:"row", gap:12 }}>
        <View style={{ flex:1 }}><VInput label="Fecha * (YYYY-MM-DD)" value={f.date} onChangeText={v=>set("date",v)} placeholder="2026-04-01" keyboardType="numeric" /></View>
        <View style={{ flex:1 }}><VInput label="Hora * (HH:MM)" value={f.time} onChangeText={v=>set("time",v)} placeholder="19:00" keyboardType="numeric" /></View>
      </View>
      <View style={{ flexDirection:"row", gap:12 }}>
        <View style={{ flex:1 }}><VInput label="Máx. jugadores" value={f.max_players} onChangeText={v=>set("max_players",v)} keyboardType="numeric" /></View>
        <View style={{ flex:1 }}>
          <Text style={u.lbl}>Nivel</Text>
          <TouchableOpacity style={u.input} onPress={() => set("skill_level",{todos:"principiante",principiante:"intermedio",intermedio:"avanzado",avanzado:"todos"}[f.skill_level])}>
            <Text style={{ color:C.white }}>{f.skill_level}</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={{ flexDirection:"row", gap:10, marginBottom:16 }}>
        <TouchableOpacity style={[s.lvlBtn,{flex:1},f.is_free&&s.lvlBtnOn]} onPress={() => set("is_free",true)}><Text style={[s.lvlTxt,f.is_free&&{color:C.orange}]}>Gratis</Text></TouchableOpacity>
        <TouchableOpacity style={[s.lvlBtn,{flex:1},!f.is_free&&s.lvlBtnOn]} onPress={() => set("is_free",false)}><Text style={[s.lvlTxt,!f.is_free&&{color:C.orange}]}>Con precio</Text></TouchableOpacity>
      </View>
      {!f.is_free&&<VInput label="Precio ($)" value={f.price} onChangeText={v=>set("price",v)} keyboardType="numeric" />}
      <OBtn title="PUBLICAR EVENTO ⚡" onPress={create} busy={busy} style={{ marginTop:8 }} />
    </ScrollView>
  );
}

// ── REQUEST CENTER ────────────────────────────
function RequestCenter({ session, coords, onDone }) {
  const [f, setF] = useState({ name:"",description:"",address:"",zona:"tigre",phone:"",instagram:"",sports:[] });
  const [busy, setBusy] = useState(false);
  const set = (k,v) => setF(p=>({...p,[k]:v}));

  const submit = async () => {
    if (!f.name||!f.address) return Alert.alert("Nombre y dirección son obligatorios");
    if (f.sports.length===0) return Alert.alert("Seleccioná al menos un deporte");
    setBusy(true);
    const res = await global.fetch(`${FN}/request-center-verification`, {
      method:"POST",
      headers:{ "Content-Type":"application/json", Authorization:`Bearer ${session?.access_token}`, apikey:SB_KEY },
      body:JSON.stringify({ ...f, lat:coords?.latitude, lng:coords?.longitude }),
    });
    const d = await res.json();
    if (d.success) { Alert.alert("✅ Solicitud enviada", "Te avisamos en 48hs"); onDone(); }
    else Alert.alert("Error", d.error||"No se pudo enviar");
    setBusy(false);
  };

  return (
    <ScrollView contentContainerStyle={{ padding:20, paddingBottom:60 }}>
      <Text style={u.h1}>🏟 Registrar Centro</Text>
      <View style={{ backgroundColor:C.orangeDim, borderRadius:10, padding:14, marginBottom:24, borderWidth:1, borderColor:C.orange }}>
        <Text style={{ color:C.orange, fontWeight:"700", fontSize:13, marginBottom:4 }}>¿Cómo funciona?</Text>
        <Text style={[u.muted,{fontSize:12,lineHeight:18}]}>1. Completá el formulario con datos reales del lugar{"\n"}2. Verificamos en 48hs{"\n"}3. Tu centro aparece verificado ✓ en el feed{"\n"}4. Podés publicar actividades y eventos</Text>
      </View>
      <VInput label="Nombre del lugar *" value={f.name} onChangeText={v=>set("name",v)} placeholder="Complejo El Talar" />
      <VInput label="Descripción" value={f.description} onChangeText={v=>set("description",v)} placeholder="¿Qué tiene el lugar?" multiline numberOfLines={3} />
      <VInput label="Dirección exacta *" value={f.address} onChangeText={v=>set("address",v)} placeholder="Av. del Libertador 5200, Tigre" />
      <Text style={u.lbl}>Zona *</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:16 }}>
        {Object.entries(ZONA_LABELS).map(([k,v]) => <Chip key={k} label={v} active={f.zona===k} onPress={() => set("zona",k)} />)}
        <View style={{ width:16 }} />
      </ScrollView>
      <VInput label="Teléfono" value={f.phone} onChangeText={v=>set("phone",v)} placeholder="+54 11 4748-0000" keyboardType="phone-pad" />
      <VInput label="Instagram" value={f.instagram} onChangeText={v=>set("instagram",v)} placeholder="@tucentro" />
      <Text style={u.lbl}>Deportes disponibles *</Text>
      <View style={{ flexDirection:"row", flexWrap:"wrap", gap:10, marginBottom:24 }}>
        {Object.entries(SPORT_ICONS).map(([k,icon]) => (
          <TouchableOpacity key={k} style={[s.sgItem,f.sports.includes(k)&&s.sgItemOn]} onPress={() => set("sports",f.sports.includes(k)?f.sports.filter(x=>x!==k):[...f.sports,k])}>
            <Text style={{ fontSize:24 }}>{icon}</Text>
            <Text style={[u.muted,{fontSize:11,marginTop:4},f.sports.includes(k)&&{color:C.orange}]}>{SPORT_LABELS[k]}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <OBtn title="ENVIAR SOLICITUD →" onPress={submit} busy={busy} />
      <Text style={[u.muted,{marginTop:12,textAlign:"center",fontSize:11}]}>Verificación gratuita · Respuesta en 48hs · Solo Zona Norte</Text>
    </ScrollView>
  );
}

// ── EXPLORE ───────────────────────────────────
function Explore({ onViewProfile }) {
  const [tab, setTab]     = useState("players");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    if (tab==="players") {
      const { data } = await supabase.from("profiles").select("id,full_name,avatar_url,zona,sports,skill_level,rating,events_joined,is_verified").ilike("full_name",`%${query}%`).limit(20);
      setResults(data||[]);
    } else {
      const { data } = await supabase.from("centers").select("*").ilike("name",`%${query}%`).limit(20);
      setResults(data||[]);
    }
    setLoading(false);
  };

  return (
    <View style={{ flex:1 }}>
      <View style={{ padding:20 }}>
        <Text style={u.h1}>Explorar</Text>
        <View style={{ flexDirection:"row", gap:8, marginBottom:16 }}>
          {[["players","👤 Jugadores"],["centers","🏟 Centros"]].map(([k,l]) => (
            <TouchableOpacity key={k} style={[{flex:1,paddingVertical:8,borderRadius:C.radiusSm,alignItems:"center",backgroundColor:tab===k?C.orange:C.dark,borderWidth:1,borderColor:tab===k?C.orange:C.mid}]} onPress={() => { setTab(k); setResults([]); }}>
              <Text style={{fontSize:12,fontWeight:"700",color:tab===k?C.black:C.muted}}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ flexDirection:"row", gap:10 }}>
          <TextInput style={[u.input,{flex:1}]} placeholder={tab==="players"?"Buscar jugadores...":"Buscar centros..."} placeholderTextColor={C.muted} value={query} onChangeText={setQuery} onSubmitEditing={search} />
          <TouchableOpacity style={{ backgroundColor:C.orange, borderRadius:C.radiusSm, paddingHorizontal:16, justifyContent:"center" }} onPress={search}>
            <Text style={{ color:C.black, fontWeight:"800", fontSize:16 }}>🔍</Text>
          </TouchableOpacity>
        </View>
      </View>
      {loading?<Loader text="Buscando..." />:results.length===0?(
        <View style={{ flex:1, alignItems:"center", justifyContent:"center" }}>
          <Text style={{ fontSize:48 }}>{tab==="players"?"👤":"🏟"}</Text>
          <Text style={[u.muted,{marginTop:12}]}>{query?"Sin resultados":"Escribí para buscar"}</Text>
        </View>
      ):(
        <FlatList data={results} keyExtractor={i=>i.id} contentContainerStyle={{ paddingHorizontal:20, gap:10 }}
          renderItem={({ item }) => tab==="players"?(
            <TouchableOpacity style={[s.card,{flexDirection:"row",alignItems:"center",padding:14}]} onPress={()=>onViewProfile(item.id)}>
              <Ava name={item.full_name} url={item.avatar_url} size={48} />
              <View style={{ flex:1, marginLeft:12 }}>
                <View style={{ flexDirection:"row", alignItems:"center", gap:6 }}>
                  <Text style={{ color:C.white, fontWeight:"700", fontSize:15 }}>{item.full_name}</Text>
                  {item.is_verified&&<Text style={{ color:C.orange }}>✓</Text>}
                </View>
                <Text style={u.muted}>{ZONA_LABELS[item.zona]||item.zona} · {item.skill_level}</Text>
                <View style={{ flexDirection:"row", gap:4, marginTop:4 }}>
                  {(item.sports||[]).slice(0,5).map(sp=><Text key={sp} style={{fontSize:14}}>{SPORT_ICONS[sp]||"🏅"}</Text>)}
                </View>
              </View>
              <View style={{ alignItems:"flex-end" }}>
                {item.rating&&<Text style={{ color:C.orange, fontSize:13 }}>⭐{Number(item.rating).toFixed(1)}</Text>}
                <Text style={[u.muted,{fontSize:11}]}>{item.events_joined} partidos</Text>
              </View>
            </TouchableOpacity>
          ):(
            <View style={[s.card,{padding:14}]}>
              <View style={{ flexDirection:"row", alignItems:"center", gap:10, marginBottom:8 }}>
                <Text style={{ fontSize:28 }}>🏟</Text>
                <View style={{ flex:1 }}>
                  <View style={{ flexDirection:"row", alignItems:"center", gap:6 }}>
                    <Text style={{ color:C.white, fontWeight:"700", fontSize:15 }}>{item.name}</Text>
                    {item.is_verified&&<Text style={{ color:C.orange }}>✓</Text>}
                  </View>
                  <Text style={u.muted}>{ZONA_LABELS[item.zona]||item.zona}</Text>
                  <Text style={[u.muted,{fontSize:11}]}>{item.address}</Text>
                </View>
              </View>
              <View style={{ flexDirection:"row", gap:4, flexWrap:"wrap" }}>
                {(item.sports||[]).map(sp=><View key={sp} style={{ backgroundColor:C.orangeDim, borderRadius:12, paddingHorizontal:8, paddingVertical:3, flexDirection:"row", gap:4 }}><Text style={{fontSize:12}}>{SPORT_ICONS[sp]||"🏅"}</Text><Text style={{color:C.orange,fontSize:11,fontWeight:"600"}}>{SPORT_LABELS[sp]}</Text></View>)}
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

// ── NOTIFS SCREEN ─────────────────────────────
function NotifsScreen({ notifs, onMarkRead }) {
  useEffect(() => { onMarkRead(); }, []);
  return (
    <View style={{ flex:1 }}>
      <View style={{ padding:20 }}><Text style={u.h1}>🔔 Notificaciones</Text></View>
      {notifs.length===0?(
        <View style={{ flex:1, alignItems:"center", justifyContent:"center" }}><Text style={{ fontSize:48 }}>🔔</Text><Text style={[u.muted,{marginTop:12}]}>Sin notificaciones</Text></View>
      ):(
        <FlatList data={notifs} keyExtractor={i=>i.id} contentContainerStyle={{ padding:20, gap:10 }}
          renderItem={({ item }) => (
            <View style={[s.card,!item.read&&{borderColor:C.orange}]}>
              <Text style={{ color:C.white, fontWeight:"700", fontSize:15, marginBottom:4 }}>{item.title}</Text>
              <Text style={[u.muted,{fontSize:13}]}>{item.body}</Text>
              <Text style={[u.muted,{fontSize:11,marginTop:8}]}>{new Date(item.created_at).toLocaleDateString("es-AR",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

// ── ROOT ──────────────────────────────────────
export default function App() {
  const [splashDone, setSplashDone] = useState(false);
  const [tab, setTab]               = useState("home");
  const [activeEvent, setActiveEvent] = useState(null);
  const [viewingUser, setViewingUser] = useState(null);
  const [showCenter, setShowCenter]   = useState(false);
  const { session, profile, loading, signOut } = useAuth();
  const { coords }                  = useGeo();
  const { notifs, unread, markRead} = useNotifs(session?.user?.id);

  if (!splashDone) return <Splash onEnter={() => setSplashDone(true)} />;
  if (loading)     return <Loader text="Iniciando VitaliApp..." />;
  if (!session)    return <Auth />;

  if (activeEvent) return (
    <SafeAreaView style={{ flex:1, backgroundColor:C.black }}>
      <StatusBar barStyle="light-content" backgroundColor={C.black} />
      <EventDetail event={activeEvent} userId={session.user.id} session={session} onBack={() => setActiveEvent(null)} />
    </SafeAreaView>
  );

  if (viewingUser) return (
    <SafeAreaView style={{ flex:1, backgroundColor:C.black }}>
      <StatusBar barStyle="light-content" backgroundColor={C.black} />
      <View style={{ flexDirection:"row", alignItems:"center", padding:16 }}>
        <TouchableOpacity onPress={() => setViewingUser(null)} style={{ width:40, height:40, justifyContent:"center" }}>
          <Text style={{ fontSize:22, color:C.white }}>←</Text>
        </TouchableOpacity>
        <Text style={[u.secLbl,{flex:1,textAlign:"center"}]}>PERFIL</Text>
        <View style={{ width:40 }} />
      </View>
      <ProfileScreen userId={viewingUser} currentUserId={session.user.id} session={session} onSignOut={signOut} />
    </SafeAreaView>
  );

  if (showCenter) return (
    <SafeAreaView style={{ flex:1, backgroundColor:C.black }}>
      <StatusBar barStyle="light-content" backgroundColor={C.black} />
      <View style={{ flexDirection:"row", alignItems:"center", padding:16 }}>
        <TouchableOpacity onPress={() => setShowCenter(false)} style={{ width:40, height:40, justifyContent:"center" }}>
          <Text style={{ fontSize:22, color:C.white }}>←</Text>
        </TouchableOpacity>
        <Text style={[u.secLbl,{flex:1,textAlign:"center"}]}>VERIFICAR CENTRO</Text>
        <View style={{ width:40 }} />
      </View>
      <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS==="ios"?"padding":undefined}>
        <ScrollView>
          <RequestCenter session={session} coords={coords} onDone={() => setShowCenter(false)} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={{ flex:1, backgroundColor:C.black }}>
      <StatusBar barStyle="light-content" backgroundColor={C.black} />
      <View style={{ flex:1 }}>
        {tab==="home"    && <Home profile={profile} onOpenEvent={ev => setActiveEvent(ev)} />}
        {tab==="explore" && <Explore onViewProfile={uid => setViewingUser(uid)} />}
        {tab==="create"  && (
          <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS==="ios"?"padding":undefined}>
            <ScrollView>
              <CreateEvent profile={profile} coords={coords} onDone={() => setTab("home")} onRequestCenter={() => setShowCenter(true)} />
            </ScrollView>
          </KeyboardAvoidingView>
        )}
        {tab==="profile" && <ScrollView><ProfileScreen userId={session.user.id} currentUserId={session.user.id} session={session} onSignOut={signOut} /></ScrollView>}
        {tab==="notifs"  && <NotifsScreen notifs={notifs} onMarkRead={markRead} />}
      </View>
      <TabBar active={tab} onChange={setTab} unread={unread} />
    </SafeAreaView>
  );
}

// ── STYLES ────────────────────────────────────
const u = StyleSheet.create({
  muted:      { color:C.muted, fontSize:13 },
  secLbl:     { fontSize:10, color:C.orange, fontWeight:"700", letterSpacing:3 },
  lbl:        { fontSize:12, color:C.muted, marginBottom:6, fontWeight:"600" },
  h1:         { fontSize:26, color:C.white, fontWeight:"900", marginBottom:6 },
  input:      { backgroundColor:C.dark, borderRadius:C.radiusSm, borderWidth:1, borderColor:C.mid, color:C.white, padding:14, fontSize:15 },
  oBtn:       { backgroundColor:C.orange, borderRadius:C.radiusSm, paddingVertical:16, alignItems:"center", shadowColor:C.orange, shadowOffset:{width:0,height:8}, shadowOpacity:0.4, shadowRadius:16, elevation:10 },
  oBtnTxt:    { fontSize:14, color:C.black, fontWeight:"800", letterSpacing:2 },
  ghostBtn:   { borderRadius:C.radiusSm, paddingVertical:16, alignItems:"center", borderWidth:1, borderColor:C.orange },
  ghostBtnTxt:{ fontSize:14, color:C.orange, fontWeight:"800", letterSpacing:1 },
  chip:       { backgroundColor:C.dark, borderRadius:C.radiusSm, paddingHorizontal:14, paddingVertical:8, marginRight:8, borderWidth:1, borderColor:C.mid },
  chipOn:     { backgroundColor:C.orangeDim, borderColor:C.orange },
  chipTxt:    { fontSize:13, color:C.muted, fontWeight:"600" },
});

const s = StyleSheet.create({
  splash:        { flex:1, backgroundColor:C.black, alignItems:"center", justifyContent:"space-between", paddingVertical:60, paddingHorizontal:28 },
  splashGlow:    { position:"absolute", width:SW*1.2, height:SW*1.2, borderRadius:SW*0.6, backgroundColor:"#FF6B0015", top:-SW*0.5, alignSelf:"center" },
  logoMark:      { width:84, height:84, borderRadius:42, backgroundColor:C.orange, alignItems:"center", justifyContent:"center", marginBottom:20, shadowColor:C.orange, shadowOffset:{width:0,height:0}, shadowOpacity:0.9, shadowRadius:30, elevation:20 },
  logoWord:      { fontSize:32, color:C.white, fontWeight:"900", letterSpacing:4 },
  logoSub:       { fontSize:11, color:C.orange, fontWeight:"700", letterSpacing:3, marginTop:6 },
  splashHero:    { fontSize:Math.min(64,SW*0.14), color:C.white, fontWeight:"900", textAlign:"center", lineHeight:Math.min(64,SW*0.14)*0.95, letterSpacing:-1 },
  topBar:        { flexDirection:"row", justifyContent:"space-between", alignItems:"center", paddingHorizontal:20, paddingTop:16, paddingBottom:12 },
  topGreet:      { fontSize:18, color:C.white, fontWeight:"800" },
  topZona:       { fontSize:11, color:C.orange, marginTop:2, fontWeight:"600" },
  statsRow:      { flexDirection:"row", backgroundColor:C.dark, marginHorizontal:20, borderRadius:C.radiusMd, padding:14, marginBottom:4 },
  sportChip:     { flexDirection:"row", alignItems:"center", backgroundColor:C.dark, borderRadius:C.radiusSm, paddingHorizontal:14, paddingVertical:10, marginRight:10, borderWidth:1, borderColor:C.mid },
  sportChipOn:   { backgroundColor:C.orangeDim, borderColor:C.orange },
  sportChipI:    { fontSize:18, marginRight:6 },
  sportChipL:    { fontSize:13, color:C.muted, fontWeight:"700" },
  badge:         { marginLeft:8, backgroundColor:C.mid, borderRadius:10, paddingHorizontal:6, paddingVertical:1 },
  card:          { backgroundColor:"#111111", borderRadius:C.radiusMd, marginHorizontal:20, marginBottom:12, padding:16, borderWidth:1, borderColor:C.mid },
  cardTitle:     { fontSize:15, color:C.white, fontWeight:"800" },
  cardDate:      { fontSize:12, color:C.orange, marginTop:3, fontWeight:"700" },
  typeBadge:     { backgroundColor:C.orangeDim, borderRadius:6, paddingHorizontal:8, paddingVertical:3 },
  typeBadgeTxt:  { fontSize:10, color:C.orange, fontWeight:"700" },
  pill:          { backgroundColor:C.mid, borderRadius:6, paddingHorizontal:8, paddingVertical:4 },
  pillTxt:       { fontSize:11, color:C.muted },
  slotBadge:     { backgroundColor:C.mid, borderRadius:6, paddingHorizontal:10, paddingVertical:5 },
  slotTxt:       { fontSize:12, color:C.muted, fontWeight:"700" },
  tabBar:        { flexDirection:"row", backgroundColor:"#0D0D0D", borderTopWidth:1, borderColor:C.mid, paddingBottom:Platform.OS==="ios"?20:8, paddingTop:8 },
  tabItem:       { flex:1, alignItems:"center", gap:3 },
  tabLbl:        { fontSize:10, color:C.muted, fontWeight:"600" },
  tabBadge:      { position:"absolute", top:-4, right:-8, backgroundColor:C.red, borderRadius:8, minWidth:16, height:16, alignItems:"center", justifyContent:"center", paddingHorizontal:2 },
  infoCell:      { flex:1, minWidth:(SW-60)/2, backgroundColor:"#111111", borderRadius:C.radiusSm, padding:14, borderWidth:1, borderColor:C.mid },
  detailCTA:     { position:"absolute", bottom:0, left:0, right:0, backgroundColor:"#111111", padding:20, paddingBottom:32, borderTopWidth:1, borderColor:C.mid },
  statusBanner:  { backgroundColor:C.orangeDim, borderRadius:C.radiusSm, padding:14, borderWidth:1, borderColor:C.orange },
  statusBannerTxt:{ color:C.orange, fontWeight:"700", textAlign:"center" },
  actionBtn:     { width:36, height:36, borderRadius:8, alignItems:"center", justifyContent:"center" },
  sgItem:        { width:(SW-68)/3, backgroundColor:C.dark, borderRadius:C.radiusSm, padding:12, alignItems:"center", borderWidth:1, borderColor:C.mid },
  sgItemOn:      { backgroundColor:C.orangeDim, borderColor:C.orange },
  lvlBtn:        { flex:1, backgroundColor:C.dark, borderRadius:C.radiusSm, paddingVertical:10, alignItems:"center", borderWidth:1, borderColor:C.mid },
  lvlBtnOn:      { backgroundColor:C.orangeDim, borderColor:C.orange },
  lvlTxt:        { fontSize:12, color:C.muted, fontWeight:"700" },
});
