package com.yutopia.model.dto;

import java.time.LocalDateTime;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class PlaceDetail {
    private Long placeId;
    private String overview;
    private String tel;
    private String homepageUrl;
    private String openingHours;
    private String closedDays;
    private String admissionFee;
    private String parkingInfo;
    private Boolean petAllowed;
    private Boolean reservationRequired;
    private String setting;
    private String introJson;
    private LocalDateTime fetchedAt;
}
