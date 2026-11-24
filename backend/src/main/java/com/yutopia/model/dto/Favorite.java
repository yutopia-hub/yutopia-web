package com.yutopia.model.dto;

import java.time.LocalDateTime;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class Favorite {
    private Long memberId;
    private Long placeId;
    private String memo;
    private LocalDateTime createdAt;
}
