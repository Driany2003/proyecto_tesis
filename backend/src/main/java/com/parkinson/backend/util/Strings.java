package com.parkinson.backend.util;

public final class Strings {

    private Strings() {}

    public static String truncate(String s, int max) {
        if (s == null) return null;
        if (s.length() <= max) return s;
        int end = max;
        while (end > 0 && Character.isSurrogate(s.charAt(end - 1))) {
            end--;
        }
        return s.substring(0, end);
    }

    public static String truncateForLog(String s, int max) {
        if (s == null) return "";
        if (s.length() <= max) return s;
        int end = max;
        while (end > 0 && Character.isSurrogate(s.charAt(end - 1))) {
            end--;
        }
        return s.substring(0, end) + "…";
    }
}
