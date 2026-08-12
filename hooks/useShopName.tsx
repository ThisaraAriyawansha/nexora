"use client";
import { useEffect, useState } from "react";
import { getShopSettings } from "@/lib/firestore";

const CACHE_KEY = "nexora:shopName";

export function useShopName() {
  const [shopName, setShopName] = useState("Nexora");

  useEffect(() => {
    const cached = window.localStorage.getItem(CACHE_KEY);
    if (cached) setShopName(cached);

    getShopSettings()
      .then((s) => {
        if (s?.name) {
          setShopName(s.name);
          window.localStorage.setItem(CACHE_KEY, s.name);
        }
      })
      .catch(() => {});
  }, []);

  return shopName;
}
