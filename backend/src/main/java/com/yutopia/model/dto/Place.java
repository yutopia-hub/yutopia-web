package com.yutopia.model.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class Place {
    private Long placeId;
    private Long categoryId;
    private Long regionId;
    private String provider;
    private String externalId;
    private String title;
    private String address;
    private String detailAddress;
    private String zipcode;
    private BigDecimal latitude;
    private BigDecimal longitude;
    private String placeUrl;
    private Boolean isActive;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
