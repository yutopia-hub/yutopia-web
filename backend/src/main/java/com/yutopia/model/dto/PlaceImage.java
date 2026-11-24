package com.yutopia.model.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class PlaceImage {
    private Long imageId;
    private Long placeId;
    private String imageUrl;
    private String thumbnailUrl;
    private String caption;
    private String source;
    private String licenseType;
    private Integer sortOrder;
}
