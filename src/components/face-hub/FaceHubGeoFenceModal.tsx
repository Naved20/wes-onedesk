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
  Check,
} from "lucide-react";
import {
  GeoFenceSettings,
  getGeoFenceSettings,
  saveGeoFenceSettings,
  playGeoBeep,
} from "@/lib/geoFenceManager";

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
      const googleTiles = L.tileLayer("https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
        maxZoom: 20,
        attribution: '&copy; Google Maps',
      });

      // OpenStreetMap Tile Layer as fallback
      const osmTiles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      });

      googleTiles.addTo(map);

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
      // Update position on existing Leaflet map instance
      const map = leafletInstanceRef.current;
      const marker = markerRef.current;
      const circle = circleRef.current;

      if (marker && circle && map) {
        const currentLatLng = marker.getLatLng();
        if (Math.abs(currentLatLng.lat - latitude) > 0.00001 || Math.abs(currentLatLng.lng - longitude) > 0.00001) {
          marker.setLatLng([latitude, longitude]);
          circle.setLatLng([latitude, longitude]);
          map.panTo([latitude, longitude]);
        }

        if (circle.getRadius() !== radiusMeters) {
          circle.setRadius(radiusMeters);
        }
      }
    }
  }, [latitude, longitude, radiusMeters, onLocationSelect]);

  return (
    <div className="relative rounded-xl overflow-hidden border border-border shadow-inner bg-slate-100 dark:bg-slate-900 h-72 w-full z-0">
      <div ref={mapRef} className="w-full h-full min-h-[288px] z-0" />
      <div className="absolute top-2 right-2 z-[1000] bg-background/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-border shadow-sm text-xs flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping"></span>
        <span className="font-semibold text-emerald-700 dark:text-emerald-400">
          Leaflet Map ({radiusMeters}m Boundary)
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

  // Address search & autocomplete states
  const [addressInput, setAddressInput] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Keep addressInput in sync with settings.address when modal opens or settings change
  useEffect(() => {
    if (settings.address && !addressInput) {
      setAddressInput(settings.address);
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
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await getGeoFenceSettings();
      setSettings(data);
      if (data.address) {
        setAddressInput(data.address);
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
        setAddressInput(finalAddress);
        setSettings((prev) => ({
          ...prev,
          latitude: lat,
          longitude: lng,
          address: finalAddress,
        }));

        setGettingLocation(false);
        toast({
          title: "Location Captured",
          description: `Captured GPS coordinates: ${lat}, ${lng}`,
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

  // Live address search / autocomplete fetching (with India-scoped results)
  const triggerAddressSearch = async (query: string) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setSearchingAddress(true);
    setShowSearchResults(true);
    try {
      // Primary: India-scoped search for fast & accurate results
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=7&addressdetails=1&countrycodes=in&accept-language=en`,
        { headers: { "Accept-Language": "en" } }
      );
      const data = await res.json();

      if (data && data.length > 0) {
        setSearchResults(data);
      } else {
        // Fallback: worldwide search if no India results
        const fallbackRes = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
          { headers: { "Accept-Language": "en" } }
        );
        const fallbackData = await fallbackRes.json();
        setSearchResults(fallbackData || []);
      }
    } catch (err) {
      console.warn("Address search API error", err);
      setSearchResults([]);
    } finally {
      setSearchingAddress(false);
    }
  };

  // Debounced input change handler (500ms delay to avoid spamming API)
  const handleAddressInputChange = (val: string) => {
    setAddressInput(val);
    setSettings((prev) => ({ ...prev, address: val }));

    // Clear previous debounce timer
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    if (val.trim().length >= 2) {
      setShowSearchResults(true);
      setSearchingAddress(true);
      searchDebounceRef.current = setTimeout(() => {
        triggerAddressSearch(val);
      }, 500);
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
      setSearchingAddress(false);
    }
  };

  // Handle selecting an address suggestion from dropdown
  const handleSelectSearchResult = (result: { display_name: string; lat: string; lon: string }) => {
    const lat = parseFloat(parseFloat(result.lat).toFixed(6));
    const lng = parseFloat(parseFloat(result.lon).toFixed(6));

    playGeoBeep.selectMapLocation();
    setAddressInput(result.display_name);
    setSettings((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lng,
      address: result.display_name,
    }));

    setShowSearchResults(false);
    toast({
      title: "Location Selected",
      description: `Map centered to: ${result.display_name.substring(0, 45)}...`,
    });
  };

  const handleLocationSelectedFromMap = (lat: number, lng: number, addressStr?: string) => {
    playGeoBeep.selectMapLocation();
    const finalAddr = addressStr || `${lat}, ${lng}`;
    setAddressInput(finalAddr);
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
        title: "✅ Geo-Fencing Saved Successfully",
        description: settings.is_enabled
          ? `Geo-Fencing is ACTIVE within ${settings.radius_meters}m boundary. All scans will now enforce this zone.`
          : "Geo-Fencing is currently DISABLED. All employees can login from any location.",
      });
      setOpen(false);
    } catch (err: any) {
      // DB save failed but local cache was updated — warn admin clearly
      toast({
        title: "⚠️ Saved Locally Only",
        description: err?.message || "Geo-Fence config saved in this browser only. Database sync failed — check Supabase connection.",
        variant: "destructive",
      });
      // Still close modal since local config is active
      setOpen(false);
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
                    Restrict FaceHub login & attendance check-ins within a specific location & Leaflet radius boundary
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

            {/* Section 2: Interactive Leaflet Map & Address Autocomplete */}
            <div className="space-y-4 p-4 rounded-xl border border-border/60 bg-card">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Globe className="h-4 w-4 text-emerald-600" />
                  Target Geo-Fence Location & Map
                </Label>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleFetchCurrentLocation}
                  disabled={gettingLocation}
                  className="h-8 text-xs flex items-center gap-1.5 bg-emerald-50 text-emerald-700 font-medium hover:bg-emerald-100 dark:bg-emerald-950/60"
                >
                  <Navigation className={`h-3.5 w-3.5 ${gettingLocation ? "animate-spin" : ""}`} />
                  {gettingLocation ? "Detecting GPS..." : "Set to My Current Location"}
                </Button>
              </div>

              {/* Address Search / Autocomplete Input (Google Maps Style) */}
              <div className="space-y-1.5 relative" ref={searchContainerRef}>
                <Label htmlFor="address-name" className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Search Location Address (Google Maps Style Autocomplete):</span>
                  {searchingAddress && (
                    <span className="text-[11px] text-emerald-600 flex items-center gap-1 animate-pulse">
                      <Loader2 className="h-3 w-3 animate-spin" /> Searching suggestions...
                    </span>
                  )}
                </Label>

                <div className="relative flex items-center">
                  <Search className="h-4 w-4 absolute left-3 text-muted-foreground pointer-events-none" />
                  <Input
                    id="address-name"
                    type="text"
                    value={addressInput}
                    onChange={(e) => handleAddressInputChange(e.target.value)}
                    onFocus={() => {
                      if (searchResults.length > 0) setShowSearchResults(true);
                    }}
                    placeholder="Type address or place name (e.g. Connaught Place, Delhi or HQ Office)"
                    className="pl-9 pr-20 text-sm font-medium focus-visible:ring-emerald-500"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => triggerAddressSearch(addressInput)}
                    className="absolute right-1 h-7 text-xs px-2.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                  >
                    Search
                  </Button>
                </div>

                {/* Autocomplete Suggestions Dropdown Menu */}
                {showSearchResults && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-[2000] bg-background border border-border rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-border/50 backdrop-blur-md">
                    {searchingAddress ? (
                      <div className="p-3 text-xs text-muted-foreground flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                        <span>Searching location options...</span>
                      </div>
                    ) : searchResults.length === 0 ? (
                      <div className="p-3 text-xs text-muted-foreground text-center">
                        No matching locations found. Try typing a broader address or landmark.
                      </div>
                    ) : (
                      searchResults.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectSearchResult(item)}
                          className="w-full text-left p-3 text-xs hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors flex items-start gap-2.5 group"
                        >
                          <MapPin className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                          <div className="space-y-0.5 min-w-0">
                            <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {item.display_name.split(",")[0]}
                            </p>
                            <p className="text-[11px] text-muted-foreground line-clamp-2">
                              {item.display_name}
                            </p>
                            <p className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                              Lat: {parseFloat(item.lat).toFixed(6)}, Lng: {parseFloat(item.lon).toFixed(6)}
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

              {/* Leaflet Map Container */}
              <div className="space-y-2 mt-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Leaflet Interactive Boundary Preview:</span>
                  <a
                    href={`https://www.google.com/maps?q=${settings.latitude},${settings.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline flex items-center gap-1"
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
