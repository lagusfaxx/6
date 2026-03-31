"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch, resolveMediaUrl, getApiBase } from "../../../lib/api";
import useMe from "../../../hooks/useMe";
import { connectRealtime } from "../../../lib/realtime";
import { getLocalMedia } from "../../../lib/webrtc";
import { getLivekitToken } from "../../../lib/livekit";
import { Room, RoomEvent, Track } from "livekit-client";
import {
  Radio, Users, Send, X, ShieldAlert, Mic, MicOff, VideoIcon, VideoOff,
  Camera, Coins, Lock, Eye, Sparkles, Gift, Settings, Plus, Trash2,
  Clock, DollarSign, Maximize2, Minimize2, ChevronDown, ChevronUp,
  Volume2, VolumeX,
} from "lucide-react";
