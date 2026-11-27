package com.yutopia.service;

import static org.junit.jupiter.api.Assertions.*;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;

import com.yutopia.exception.ApiException;

class YutoConversationStoreTest {
    @Test
    void expiredConversationIsInaccessible() {
        var clock = new MutableClock();
        var store = new YutoConversationStore(clock);
        var id = store.create(1, YutoTestSupport.course("course")).conversationId();
        clock.now = clock.now.plus(YutoConversationStore.TTL);
        assertThrows(ApiException.class, () -> store.read(1, id));
    }

    @Test
    void ownerLimitCanBeRecoveredByDeletingConversation() {
        var store = new YutoConversationStore();
        String first = store.create(1, YutoTestSupport.course("course")).conversationId();
        for (int i = 0; i < 4; i++) store.create(1, YutoTestSupport.course("course" + i));
        assertThrows(ApiException.class, () -> store.create(1, YutoTestSupport.course("sixth")));
        assertDoesNotThrow(() -> store.create(2, YutoTestSupport.course("another-owner")));
        store.delete(1, first);
        assertDoesNotThrow(() -> store.create(1, YutoTestSupport.course("replacement")));
    }

    @Test
    void creationPurgesExpiredEntriesBeforeApplyingLimits() {
        var clock = new MutableClock();
        var store = new YutoConversationStore(clock);
        for (int i = 0; i < 5; i++) store.create(1, YutoTestSupport.course("course" + i));
        clock.now = clock.now.plusSeconds(1801);
        assertDoesNotThrow(() -> store.create(1, YutoTestSupport.course("new")));
    }

    private static final class MutableClock extends Clock {
        Instant now = Instant.parse("2026-11-27T00:00:00Z");
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }
}
