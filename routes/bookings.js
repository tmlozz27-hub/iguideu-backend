import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { apiGet, API_BASE } from "../lib/api";

type Guide = {
  _id: string;
  name?: string;
  city?: string;
  country?: string;
  hourlyRateUsd?: number;
  dayRateUsd?: number;
};

export default function BookingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ guideId?: string }>();
  const guideId = params.guideId || "";

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [guide, setGuide] = useState<Guide | null>(null);

  const [email, setEmail] = useState("test+frontend@iguideu.com");
  const [hours, setHours] = useState(3);
  const [dayType, setDayType] = useState<"HOURS" | "DAY">("HOURS");

  useEffect(() => {
    (async () => {
      const data = await apiGet("/api/guides");
      const g = data?.guides?.find((x: any) => x._id === guideId);
      setGuide(g || null);
      setLoading(false);
    })();
  }, [guideId]);

  const totalUsd = useMemo(() => {
    if (!guide) return 0;
    if (dayType === "DAY") return guide.dayRateUsd || 0;
    return (guide.hourlyRateUsd || 0) * hours;
  }, [guide, hours, dayType]);

  const createBooking = async () => {
    if (!guide) return;
    setCreating(true);

    const body = {
      guideId,
      guideName: guide.name,
      city: guide.city,
      country: guide.country,
      email,
      hours,
      dayType,
      totalUsd,
    };

    try {
      const res = await fetch(`${API_BASE}/api/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Error");

      alert(`Reserva creada ✅\nID: ${data.booking._id}`);
      router.replace("/reservas");
    } catch (e: any) {
      alert(`ERROR creando reserva: ${e.message}`);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: "900" }}>Reservar</Text>

      <Text style={{ marginTop: 8, fontWeight: "800" }}>{guide?.name}</Text>
      <Text>{guide?.city} · {guide?.country}</Text>
      <Text>${guide?.hourlyRateUsd} / hora · ${guide?.dayRateUsd} / día</Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        style={{ borderWidth: 1, marginTop: 12, padding: 10 }}
      />

      <Pressable
        onPress={() => setDayType("HOURS")}
        style={{ marginTop: 12 }}
      >
        <Text>Horas</Text>
      </Pressable>

      <Pressable
        onPress={() => setDayType("DAY")}
        style={{ marginTop: 4 }}
      >
        <Text>Día</Text>
      </Pressable>

      <Pressable
        onPress={createBooking}
        style={{ backgroundColor: "#111", padding: 14, marginTop: 20 }}
        disabled={creating}
      >
        <Text style={{ color: "white", textAlign: "center", fontWeight: "900" }}>
          {creating ? "Creando..." : "Crear reserva (USD " + totalUsd + ")"}
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}
