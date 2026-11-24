package com.yutopia.model.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 화면 조회용 읽기 모델. places + place_details + 대표 이미지 + 태그 + 시도(region level 1)를 한 번에 JOIN 한다.
 * 찜 목록 조회 시에는 memo / addedAt 도 채워진다.
 */
@Getter
@Setter
@NoArgsConstructor
public class PlaceView {
    private Long placeId;
    private String provider;
    private String externalId;
    private String title;
    private String address;
    private String detailAddress;
    private BigDecimal latitude;
    private BigDecimal longitude;
    private String placeUrl;
    private String contentTypeId;
    private String cat1;
    private String cat2;
    private String cat3;
    private Long areaId;
    private String areaName;
    private String categoryName;
    private String image;
    private String thumbnail;
    private String tel;
    private String setting;
    private Boolean petAllowed;
    /** '|' 로 이어 붙인 태그 */
    private String tags;
    private String overview;
    private String homepageUrl;
    private String introJson;
    private String memo;
    private LocalDateTime addedAt;
}
