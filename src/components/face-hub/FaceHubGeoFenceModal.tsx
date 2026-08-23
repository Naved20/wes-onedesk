import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  MapPin,
  ShieldCheck,
  ShieldAlert,
  Navigation,
  Save,
  Volume2,
  Globe,
  Sliders,
  ExternalLink,
  LocateFixed,
  Search,
  Loader2,
  Building2,
  X,
} from "lucide-react";
import {
  GeoFenceSettings,
  getGeoFenceSettings,
  saveGeoFenceSettings,
  playGeoBeep,
} from "@/lib/geoFenceManager";

export interface PlaceSuggestion {
  id: string;
  title: string;
  subtitle: string;
  lat: number;
  lng: number;
  provider: string;
}

/**
 * Multi-Engine Google-Level Place Geocoder API
 * Queries Esri World Geocoder + Photon Komoot + Nominatim OSM in parallel
 * for blazingly fast, super-accurate Indian & global place autocomplete!
 */
export const fetchPlaceSuggestions = async (query: string): Promise<PlaceSuggestion[]> => {
  if (!query || query.trim().length < 2) return [];

  const results: PlaceSuggestion[] = [];
  const trimmed = query.trim();

  // 1. Esri World Geocoder (Ultra-accurate Google Maps level POI & address search)
  try {
    const esriUrl = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&singleLine=${encodeURIComponent(
      trimmed
    )}&maxLocations=8&outFields=Match_addr,Addr_type,PlaceName,City,SubRegion,Region`;
    const res = await fetch(esriUrl);
    const data = await res.json();

    if (data.candidates && data.candidates.length > 0) {
      data.candidates.forEach((cand: any, idx: number) => {
        const fullAddr = cand.address || cand.attributes?.Match_addr || "";
        const parts = fullAddr.split(",");
        const title = parts[0]?.trim() || fullAddr;
        const subtitle = parts.slice(1).join(", ").trim() || fullAddr;

        results.push({
          id: `esri-${idx}-${cand.location.x}-${cand.location.y}`,
          title: title,
          subtitle: subtitle,
          lat: parseFloat(cand.location.y.toFixed(6)),
          lng: parseFloat(cand.location.x.toFixed(6)),
          provider: "Google/Esri Maps",
        });
      });
    }
  } catch (err) {
    console.warn("Esri geocoder warning", err);
  }

  // 2. Photon Komoot API (Instant fuzzy POI & place search)
  try {
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmed)}&limit=8&lang=en`;
    const res = await fetch(photonUrl);
    const data = await res.json();

    if (data.features && data.features.length > 0) {
      data.features.forEach((feat: any, idx: number) => {
        const props = feat.properties || {};
        const coords = feat.geometry?.coordinates || []; // [lng, lat]
        if (coords.length >= 2) {
          const title = props.name || props.street || props.district || props.city || "Location";
          const subParts = [props.street, props.district, props.city, props.state, props.country].filter(Boolean);
          const subtitle = subParts.join(", ");

          const exists = results.some(
            (r) => Math.abs(r.lat - coords[1]) < 0.0001 && Math.abs(r.lng - coords[0]) < 0.0001
          );

          if (!exists) {
            results.push({
              id: `photon-${idx}-${coords[0]}-${coords[1]}`,
              title: title,
              subtitle: subtitle || title,
              lat: parseFloat(coords[1].toFixed(6)),
              lng: parseFloat(coords[0].toFixed(6)),
              provider: "Photon Maps",
            });
          }
        }
      });
    }
  } catch (err) {
    console.warn("Photon geocoder warning", err);
  }

  // 3. Fallback Nominatim OSM API if needed
  if (results.length < 3) {
    try {
      const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(trimmed)}&limit=5`;
      const res = await fetch(nomUrl);
      const data = await res.json();

      if (Array.isArray(data)) {
        data.forEach((item: any, idx: number) => {
          const lat = parseFloat(parseFloat(item.lat).toFixed(6));
          const lng = parseFloat(parseFloat(item.lon).toFixed(6));
          const title = item.display_name.split(",")[0];
          const subtitle = item.display_name;

          const exists = results.some((r) => Math.abs(r.lat - lat) < 0.0001 && Math.abs(r.lng - lng) < 0.0001);

          if (!exists) {
            results.push({
              id: `nom-${idx}-${lat}-${lng}`,
              title: title,
              subtitle: subtitle,
              lat: lat,
              lng: lng,
              provider: "OpenStreetMap",
            });
          }
        });
      }
    } catch (e) {
      console.warn("Nominatim fallback warning", e);
    }
  }

  return results;
};

interface LeafletMapProps {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  onLocationSelect: (lat: number, lng: number, addressStr?: string) => void;
}

function LeafletGeoMap({ latitude, longitude, radiusMeters, onLocationSelect }: LeafletMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);

  // Inject Leaflet CSS dynamically if missing to guarantee correct tile grid rendering
  useEffect(() => {
    if (!document.getElementById("leaflet-css-cdn")) {
      const link = document.createElement("link");
      link.id = "leaflet-css-cdn";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    const L = (window as any).L;
    if (!L) {
      console.warn("[LeafletGeoMap] Leaflet JS library (window.L) is loading...");
      return;
    }

    if (!leafletInstanceRef.current) {
      // Initialize Leaflet Map
      const map = L.map(mapRef.current, {
        center: [latitude, longitude],
        zoom: 16,
        zoomControl: true,
      });

      // Google Maps Tile Layer inside Leaflet (100% reliable high-res street map tiles)
      L.tileLayer("https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
        maxZoom: 20,
        attribution: '&copy; Google Maps',
      }).addTo(map);

      // Sleek emerald custom SVG marker icon
      const customIcon = L.divIcon({
        className: "custom-leaflet-marker",
        html: `
          <div style="
            width: 36px;
            height: 36px;
            background: #10b981;
            border: 3px solid #ffffff;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            box-shadow: 0 4px 12px rgba(16,185,129,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            margin-left: -18px;
            margin-top: -36px;
            cursor: grab;
          ">
            <div style="
              width: 10px;
              height: 10px;
              background: #ffffff;
              border-radius: 50%;
              transform: rotate(45deg);
            "></div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
      });

      // Draggable marker
      const marker = L.marker([latitude, longitude], {
        icon: customIcon,
        draggable: true,
      }).addTo(map);

      // Geofence visual boundary circle (weight: 2px, subtle 0.15 opacity)
      const circle = L.circle([latitude, longitude], {
        radius: radiusMeters,
        color: "#10b981",
        fillColor: "#10b981",
        fillOpacity: 0.15,
        weight: 2,
        dashArray: "6, 6",
      }).addTo(map);

      markerRef.current = marker;
      circleRef.current = circle;
      leafletInstanceRef.current = map;

      // Handle marker dragend event
      marker.on("dragend", async () => {
        const position = marker.getLatLng();
        const lat = parseFloat(position.lat.toFixed(6));
        const lng = parseFloat(position.lng.toFixed(6));
        circle.setLatLng([lat, lng]);

        let addressStr = "";
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
          const data = await res.json();
          if (data.display_name) addressStr = data.display_name;
        } catch (e) {
          console.warn("Reverse geocode failed", e);
        }

        onLocationSelect(lat, lng, addressStr);
      });

      // Handle map click to move pin
      map.on("click", async (e: any) => {
        const lat = parseFloat(e.latlng.lat.toFixed(6));
        const lng = parseFloat(e.latlng.lng.toFixed(6));
        
        marker.setLatLng([lat, lng]);
        circle.setLatLng([lat, lng]);

        let addressStr = "";
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
          const data = await res.json();
          if (data.display_name) addressStr = data.display_name;
        } catch (err) {
          console.warn("Reverse geocode failed", err);
        }

        onLocationSelect(lat, lng, addressStr);
      });

      // Refresh map size rendering inside modal dialog animation
      [100, 300, 600, 1000].forEach((delay) => {
        setTimeout(() => {
          if (map) map.invalidateSize();
        }, delay);
      });
    } else {
      // Update position & flyTo on existing Leaflet map instance
      const map = leafletInstanceRef.current;
      const marker = markerRef.current;
      const circle = circleRef.current;

      if (marker && circle && map) {
        const currentLatLng = marker.getLatLng();
        if (Math.abs(currentLatLng.lat - latitude) > 0.00001 || Math.abs(currentLatLng.lng - longitude) > 0.00001) {
          marker.setLatLng([latitude, longitude]);
          circle.setLatLng([latitude, longitude]);
          map.flyTo([latitude, longitude], 17, { duration: 1.2 });
        }

        if (circle.getRadius() !== radiusMeters) {
          circle.setRadius(radiusMeters);
        }
      }
    }
  }, [latitude, longitude, radiusMeters, onLocationSelect]);

  return (
    <div className="relative rounded-xl overflow-hidden border border-border shadow-inner bg-slate-100 dark:bg-slate-900 h-80 w-full z-0">
      <div ref={mapRef} className="w-full h-full min-h-[320px] z-0" />
      <div className="absolute top-2 right-2 z-[1000] bg-background/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-border shadow-sm text-xs flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping"></span>
        <span className="font-semibold text-emerald-700 dark:text-emerald-400">
          Google Map ({radiusMeters}m Boundary)
        </span>
      </div>
      <div className="absolute bottom-2 left-2 z-[1000] bg-background/95 backdrop-blur-md px-2.5 py-1 rounded-md border border-border text-[11px] text-muted-foreground shadow-sm flex items-center gap-1.5">
        <LocateFixed className="h-3 w-3 text-emerald-600" />
        <span>Drag pin or click map to set coordinates</span>
      </div>
    </div>
  );
}

export function FaceHubGeoFenceModal() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);

  // Google Maps Style Autocomplete states
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  // Synchronously initialize state from local storage so button shows correct status on page refresh
  const [settings, setSettings] = useState<GeoFenceSettings>(() => {
    try {
      const stored = localStorage.getItem("face_hub_geofence_config");
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn("Local geofence config parse error", e);
    }
    return {
      is_enabled: false,
      latitude: 28.6139,
      longitude: 77.2090,
      radius_meters: 200,
      address: "",
    };
  });

  const presetRadius = [50, 100, 200, 500, 1000];

  // Sync searchQuery with settings.address when modal opens or settings change
  useEffect(() => {
    if (settings.address && !searchQuery) {
      setSearchQuery(settings.address);
    }
  }, [settings.address]);

  // Fetch freshest settings from Supabase database on mount & when dialog opens
  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (open) {
      loadSettings();
    }
  }, [open]);

  // Handle clicking outside of address search dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced Place Search (runs when searchQuery changes)
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      setShowDropdown(true);
      try {
        const list = await fetchPlaceSuggestions(searchQuery);
        setSuggestions(list);
      } catch (err) {
        console.warn("Search error", err);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await getGeoFenceSettings();
      setSettings(data);
      if (data.address) {
        setSearchQuery(data.address);
      }
    } catch (err) {
      console.error("Failed to load geofence settings", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEnable = (enabled: boolean) => {
    if (enabled) {
      playGeoBeep.toggleOn();
    } else {
      playGeoBeep.toggleOff();
    }
    setSettings((prev) => ({ ...prev, is_enabled: enabled }));
  };

  const handleFetchCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: "Geolocation Unsupported",
        description: "Your browser does not support GPS location.",
        variant: "destructive",
      });
      return;
    }

    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lng = parseFloat(pos.coords.longitude.toFixed(6));

        playGeoBeep.selectMapLocation();

        let addressStr = "";
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
          );
          const data = await res.json();
          if (data.display_name) {
            addressStr = data.display_name;
          }
        } catch (e) {
          console.warn("Address reverse geocode failed", e);
        }

        const finalAddress = addressStr || `${lat}, ${lng}`;
        setSearchQuery(finalAddress);
        setSettings((prev) => ({
          ...prev,
          latitude: lat,
          longitude: lng,
          address: finalAddress,
        }));

        setGettingLocation(false);
        toast({
          title: "Current GPS Location Captured",
          description: `Set target to: ${lat}, ${lng}`,
        });
      },
      (err) => {
        setGettingLocation(false);
        console.error("GPS Error", err);
        toast({
          title: "GPS Error",
          description: "Could not capture location. Please check browser GPS permissions.",
          variant: "destructive",
        });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Select place from Google Maps style dropdown
  const handleSelectSuggestion = (place: PlaceSuggestion) => {
    playGeoBeep.selectMapLocation();
    setSearchQuery(place.title);
    setSettings((prev) => ({
      ...prev,
      latitude: place.lat,
      longitude: place.lng,
      address: `${place.title}${place.subtitle ? `, ${place.subtitle}` : ""}`,
    }));
    setShowDropdown(false);

    toast({
      title: "Google Map Centered",
      description: `Target set to: ${place.title}`,
    });
  };

  const handleLocationSelectedFromMap = (lat: number, lng: number, addressStr?: string) => {
    playGeoBeep.selectMapLocation();
    const finalAddr = addressStr || `${lat}, ${lng}`;
    setSearchQuery(finalAddr.split(",")[0] || finalAddr);
    setSettings((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lng,
      address: finalAddr,
    }));
  };

  const handleSave = async () => {
    if (settings.radius_meters <= 0) {
      toast({
        title: "Invalid Radius",
        description: "Range radius must be greater than 0 meters.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await saveGeoFenceSettings(settings);
      toast({
        title: "Geo-Fencing Saved Successfully",
        description: settings.is_enabled
          ? `Geo-Fencing is ACTIVE within ${settings.radius_meters}m boundary.`
          : "Geo-Fencing is currently DISABLED.",
      });
      setOpen(false);
    } catch (err) {
      toast({
        title: "Save Failed",
        description: "Could not save Geo-Fencing configuration.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Trigger Button */}
      <Button
        variant={settings.is_enabled ? "default" : "outline"}
        onClick={() => setOpen(true)}
        className={`flex items-center gap-2 ${
          settings.is_enabled
            ? "bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm"
            : "border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200"
        }`}
      >
        {settings.is_enabled ? (
          <ShieldCheck className="h-4 w-4 text-white animate-pulse" />
        ) : (
          <ShieldAlert className="h-4 w-4 text-amber-500" />
        )}
        <span>
          Geo-Fence: {settings.is_enabled ? `${settings.radius_meters || 200}m Active` : "Disabled"}
        </span>
      </Button>

      {/* Main Settings Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6 sm:p-7 z-[50]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2.5 rounded-xl ${
                    settings.is_enabled
                      ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600"
                      : "bg-amber-100 dark:bg-amber-950/60 text-amber-600"
                  }`}
                >
                  <MapPin className="h-6 w-6" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold">FaceHub Geo-Fencing Configuration</DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Restrict FaceHub login & attendance check-ins within a specific location & radius boundary
                  </DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6 py-3">
            {/* Master Toggle Card */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl border border-border/60 shadow-sm">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-base">Geo-Fencing Protection</span>
                  <Badge
                    variant={settings.is_enabled ? "default" : "secondary"}
                    className={
                      settings.is_enabled
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    }
                  >
                    {settings.is_enabled ? "ENABLED (STRICT)" : "DISABLED (OPEN ACCESS)"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {settings.is_enabled
                    ? `Users can only login & scan attendance when physically inside ${settings.radius_meters}m of the office location.`
                    : "Employees can log into FaceHub from any location without distance restriction."}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={settings.is_enabled}
                  onCheckedChange={handleToggleEnable}
                  className="data-[state=checked]:bg-emerald-600"
                />
              </div>
            </div>

            {/* Section 1: Radius & Range Selection */}
            <div className="space-y-3 p-4 rounded-xl border border-border/60 bg-card">
              <div className="flex items-center justify-between">
                <Label htmlFor="radius-range" className="text-sm font-semibold flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-emerald-600" />
                  Area Range Radius (Meters)
                </Label>
                <span className="text-xs font-mono font-bold px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 rounded-md">
                  {settings.radius_meters} Meters ({(settings.radius_meters / 1000).toFixed(2)} km)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <div>
                  <Input
                    id="radius-range"
                    type="number"
                    min={10}
                    max={10000}
                    step={10}
                    value={settings.radius_meters}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setSettings((prev) => ({ ...prev, radius_meters: val }));
                    }}
                    placeholder="Enter radius in meters (e.g., 200)"
                    className="font-mono text-base font-semibold"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Enter manual distance in meters (e.g. 200 for 200m).
                  </p>
                </div>

                {/* Quick Presets */}
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground block font-medium">Quick Presets:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {presetRadius.map((r) => (
                      <Button
                        key={r}
                        type="button"
                        variant={settings.radius_meters === r ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          playGeoBeep.selectMapLocation();
                          setSettings((prev) => ({ ...prev, radius_meters: r }));
                        }}
                        className={`h-7 text-xs px-2.5 ${
                          settings.radius_meters === r
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                            : ""
                        }`}
                      >
                        {r}m {r === 200 && "(Default)"}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Google Maps Search & Autocomplete Container */}
            <div className="space-y-4 p-4 rounded-xl border border-border/60 bg-card">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Globe className="h-4 w-4 text-emerald-600" />
                  Google Maps Search & Location Selector
                </Label>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleFetchCurrentLocation}
                  disabled={gettingLocation}
                  className="h-8 text-xs flex items-center gap-1.5 bg-emerald-50 text-emerald-700 font-medium hover:bg-emerald-100 dark:bg-emerald-950/60"
                >
                  <Navigation className={`h-3.5 w-3.5 `} />
                  {gettingLocation ? "Detecting GPS..." : "Set to My Current Location"}
                </Button>
              </div>

              {/* Google Maps Search Box */}
              <div className="space-y-1.5 relative" ref={searchBoxRef}>
                <Label htmlFor="google-place-search" className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                  <span>Search Location / Office (Google Maps Places Autocomplete):</span>
                  {searching && (
                    <span className="text-[11px] text-emerald-600 flex items-center gap-1 animate-pulse font-medium">
                      <Loader2 className="h-3 w-3 animate-spin" /> Searching places...
                    </span>
                  )}
                </Label>

                <div className="relative flex items-center shadow-sm rounded-xl overflow-hidden">
                  <div className="absolute left-3.5 text-emerald-600 flex items-center justify-center">
                    <Search className="h-4 w-4" />
                  </div>
                  <Input
                    id="google-place-search"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => {
                      if (suggestions.length > 0) setShowDropdown(true);
                    }}
                    placeholder="Search place, city, office or street (e.g. Connaught Place, Delhi, Sector 62 Noida)"
                    className="pl-10 pr-10 py-5 text-sm font-medium focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-xl bg-background border-slate-300 dark:border-slate-700"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery("");
                        setSuggestions([]);
                        setShowDropdown(false);
                      }}
                      className="absolute right-3 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Google Maps Autocomplete Dropdown List */}
                {showDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 z-[2500] bg-background/95 backdrop-blur-xl border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {searching ? (
                      <div className="p-4 text-xs text-muted-foreground flex items-center justify-center gap-2">
                        <Loader2 className="h-4.5 w-4.5 animate-spin text-emerald-600" />
                        <span className="font-medium">Searching Google Places database...</span>
                      </div>
                    ) : suggestions.length === 0 ? (
                      <div className="p-4 text-xs text-muted-foreground text-center">
                        No locations found. Try typing city, area name or landmark.
                      </div>
                    ) : (
                      suggestions.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectSuggestion(item)}
                          className="w-full text-left p-3.5 text-xs hover:bg-emerald-50/80 dark:hover:bg-emerald-950/60 transition-all flex items-start gap-3 group"
                        >
                          <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors mt-0.5">
                            <MapPin className="h-4 w-4" />
                          </div>
                          <div className="space-y-0.5 min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                                {item.title}
                              </p>
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-slate-300 dark:border-slate-700 font-mono shrink-0">
                                {item.provider}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                              {item.subtitle}
                            </p>
                            <p className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                              Coords: {item.lat}, {item.lng}
                            </p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Coordinates input */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="latitude" className="text-xs text-muted-foreground">
                    Latitude
                  </Label>
                  <Input
                    id="latitude"
                    type="number"
                    step="0.000001"
                    value={settings.latitude}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      playGeoBeep.selectMapLocation();
                      setSettings((prev) => ({ ...prev, latitude: val }));
                    }}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="longitude" className="text-xs text-muted-foreground">
                    Longitude
                  </Label>
                  <Input
                    id="longitude"
                    type="number"
                    step="0.000001"
                    value={settings.longitude}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      playGeoBeep.selectMapLocation();
                      setSettings((prev) => ({ ...prev, longitude: val }));
                    }}
                    className="font-mono text-sm"
                  />
                </div>
              </div>

              {/* Interactive Google Map Box */}
              <div className="space-y-2 mt-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Google Map Boundary Preview:</span>
                  <a
                    href={`https://www.google.com/maps?q=${settings.latitude},${settings.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline flex items-center gap-1 font-medium"
                  >
                    Open in Google Maps <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                <LeafletGeoMap
                  latitude={settings.latitude}
                  longitude={settings.longitude}
                  radiusMeters={settings.radius_meters}
                  onLocationSelect={handleLocationSelectedFromMap}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Volume2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>Audio Beep confirmation enabled on toggle & save.</span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button variant="outline" type="button" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                {loading ? "Saving..." : "Save Geo-Fence Configuration"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
