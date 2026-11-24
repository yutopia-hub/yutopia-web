package com.yutopia;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@MapperScan("com.yutopia.model.dao")
public class YutopiaApplication {

	public static void main(String[] args) {
		SpringApplication.run(YutopiaApplication.class, args);
	}

}
