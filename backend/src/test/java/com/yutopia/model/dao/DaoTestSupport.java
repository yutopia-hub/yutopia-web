package com.yutopia.model.dao;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.sql.Statement;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.function.Executable;
import org.springframework.dao.DataAccessException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.DefaultTransactionDefinition;

import com.yutopia.model.dto.*;
import com.yutopia.support.DaoTestConfiguration;

abstract class DaoTestSupport {
    private static ConfigurableApplicationContext context;
    private PlatformTransactionManager transactionManager;
    private TransactionStatus transaction;

    @BeforeAll
    static void startContext() {
        context = new SpringApplicationBuilder(DaoTestConfiguration.class)
                .profiles("test", "dao-test").web(WebApplicationType.NONE).run();
    }

    @BeforeEach
    void startRollbackOnlyTransaction() {
        context.getAutowireCapableBeanFactory().autowireBean(this);
        transactionManager = context.getBean(PlatformTransactionManager.class);
        transaction = transactionManager.getTransaction(new DefaultTransactionDefinition());
    }

    @AfterEach
    void rollback() {
        if (transaction != null && !transaction.isCompleted()) transactionManager.rollback(transaction);
    }

    @AfterAll
    static void closeContext() {
        if (context != null) context.close();
    }

    protected static final String PASSWORD_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";
    protected final String prefix = "junit-" + UUID.randomUUID();

    @Autowired protected MemberDao members;
    @Autowired protected PlaceDao places;
    @Autowired protected RegionDao regions;
    @Autowired protected PlaceCategoryDao categories;
    @Autowired protected PlaceDetailDao details;
    @Autowired protected PlaceImageDao images;
    @Autowired protected PlaceTagDao tags;
    @Autowired protected FavoriteDao favorites;
    @Autowired protected JdbcTemplate jdbc;

    protected Member newMember() {
        Member member = new Member();
        member.setEmail(prefix + "-" + UUID.randomUUID() + "@example.invalid");
        member.setNickname("테스트 회원");
        member.setPasswordHash(PASSWORD_HASH);
        return member;
    }

    protected Member member() {
        Member member = newMember();
        assertEquals(1, members.insert(member));
        assertNotNull(member.getMemberId());
        return member;
    }

    // Region/category DAOs are read-only, so parent fixtures use test-only JDBC.
    protected Region region(String name, Long parentId) {
        Region region = new Region();
        region.setParentId(parentId);
        region.setRegionName(prefix + " " + name);
        region.setRegionCode(UUID.randomUUID().toString().substring(0, 20));
        region.setRegionLevel(parentId == null ? 1 : 2);
        region.setRegionId(insertKey("INSERT INTO regions(parent_id,region_name,region_code,region_level) VALUES (?,?,?,?)",
                parentId, region.getRegionName(), region.getRegionCode(), region.getRegionLevel()));
        return region;
    }

    protected PlaceCategory category(String name, Long parentId) {
        PlaceCategory category = new PlaceCategory();
        category.setParentId(parentId);
        category.setCategoryName(prefix + " " + name);
        category.setCategoryId(insertKey("INSERT INTO place_categories(parent_id,category_name) VALUES (?,?)",
                parentId, category.getCategoryName()));
        return category;
    }

    protected Place newPlace(String title, Long regionId, Long categoryId) {
        Place place = new Place();
        place.setTitle(prefix + " " + title);
        place.setRegionId(regionId);
        place.setCategoryId(categoryId);
        place.setProvider("USER");
        place.setExternalId("junit-" + UUID.randomUUID());
        place.setAddress("서울특별시 테스트로 1");
        place.setDetailAddress("2층");
        place.setZipcode("01234");
        place.setLatitude(new BigDecimal("37.1234567"));
        place.setLongitude(new BigDecimal("127.1234567"));
        place.setPlaceUrl("https://example.invalid/" + place.getExternalId());
        return place;
    }

    protected Place place(String title, Long regionId, Long categoryId) {
        Place place = newPlace(title, regionId, categoryId);
        assertEquals(1, places.insert(place));
        assertNotNull(place.getPlaceId());
        return place;
    }

    protected Place place() {
        return place("여행지", region("서울", null).getRegionId(), category("관광지", null).getCategoryId());
    }

    protected PlaceDetail detail(Place place) {
        PlaceDetail detail = new PlaceDetail();
        detail.setPlaceId(place.getPlaceId());
        detail.setOverview(prefix + " 상세 설명");
        detail.setTel("02-123-4567");
        detail.setHomepageUrl("https://example.invalid/info");
        detail.setOpeningHours("09:00~18:00");
        detail.setClosedDays("월요일");
        detail.setAdmissionFee("무료");
        detail.setParkingInfo("주차 가능");
        detail.setPetAllowed(true);
        detail.setReservationRequired(false);
        detail.setIntroJson("{\"info\":\"테스트 안내\"}");
        detail.setFetchedAt(LocalDateTime.of(2026, 11, 13, 10, 20, 30));
        return detail;
    }

    protected PlaceImage image(Place place, Integer order) {
        PlaceImage image = new PlaceImage();
        image.setPlaceId(place.getPlaceId());
        image.setImageUrl("https://example.invalid/" + prefix + "/" + UUID.randomUUID() + ".jpg");
        image.setThumbnailUrl(image.getImageUrl() + "?thumbnail=1");
        image.setCaption(prefix + " 이미지");
        image.setSource("JUnit fixture");
        image.setLicenseType("TEST");
        image.setSortOrder(order);
        return image;
    }

    protected PlaceTag tag(Place place, String name) {
        PlaceTag tag = new PlaceTag();
        tag.setPlaceId(place.getPlaceId());
        tag.setTag(name);
        return tag;
    }

    protected Favorite favorite(Member member, Place place, String memo) {
        Favorite favorite = new Favorite();
        favorite.setMemberId(member.getMemberId());
        favorite.setPlaceId(place.getPlaceId());
        favorite.setMemo(memo);
        assertEquals(1, favorites.insert(favorite));
        return favorite;
    }

    protected Long missingPlaceId() {
        Place missing = place();
        assertEquals(1, places.deleteById(missing.getPlaceId()));
        return missing.getPlaceId();
    }

    protected Long missingMemberId() {
        Member missing = member();
        assertEquals(1, members.deleteById(missing.getMemberId()));
        return missing.getMemberId();
    }

    protected List<Long> placeIds(List<Place> rows) {
        return rows.stream().map(Place::getPlaceId).toList();
    }

    protected void assertCheckViolation(String constraint, Executable statement) {
        // MySQL reports CHECK failures as HY000 / 3819, not SQLState class 23.
        var failure = assertThrows(DataAccessException.class, statement);
        var cause = assertInstanceOf(SQLException.class, failure.getMostSpecificCause());
        assertEquals(3819, cause.getErrorCode());
        assertTrue(cause.getMessage().contains(constraint));
    }

    private Long insertKey(String sql, Object... values) {
        GeneratedKeyHolder key = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            var statement = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            for (int i = 0; i < values.length; i++) statement.setObject(i + 1, values[i]);
            return statement;
        }, key);
        return key.getKey().longValue();
    }
}
