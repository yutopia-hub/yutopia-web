package com.yutopia.service;

import static org.junit.jupiter.api.Assertions.*;

import java.time.Instant;
import java.util.LinkedHashMap;

import org.junit.jupiter.api.Test;

import com.yutopia.exception.ApiException;
import com.yutopia.resource.RoutePlaceSearchRequest.Kind;

class YutoCourseToolsTest {
    @Test
    void candidatesAreBoundToRouteDirectionAndExpiredEntriesAreDiscarded() {
        var providers = new YutoTestSupport();
        var course = YutoTestSupport.course("course");
        var tools = new YutoCourseTools(course, new LinkedHashMap<>(), providers.walkingTool, providers.searchTool, providers.detourTool);
        tools.searchPlacesAlongRoute("a", "b", false, Kind.RESTAURANT, null, null);
        assertThrows(ApiException.class, () -> tools.compareDetourTime("b", "a", "kakao:food", false, null));
        assertThrows(ApiException.class, () -> tools.compareDetourTime("a", "b", "kakao:food", true, null));
        var old = new LinkedHashMap<String, YutoCourseTools.Candidate>();
        tools.candidates().forEach((key, value) -> old.put(key,
                new YutoCourseTools.Candidate(value.route(), value.place(), Instant.now().minusSeconds(601))));
        var later = new YutoCourseTools(course, old, providers.walkingTool, providers.searchTool, providers.detourTool);
        assertTrue(later.availableCandidates().isEmpty());
        assertThrows(ApiException.class, () -> later.compareDetourTime("a", "b", "kakao:food", false, null));
        assertEquals(0, providers.walking.viaCalls);
    }
}
